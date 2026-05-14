/*
 * SiloGuard - Smart Rice Storage Monitoring System
 * ESP32 Firmware v2.3
 *
 * Sends sensor readings directly to Supabase:
 *   UPSERT /rest/v1/current_sensor_readings every 2 seconds
 *   INSERT /rest/v1/sensor_readings every 60 seconds
 *
 * Prints every reading cycle to the Serial Monitor and keeps one compact
 * retry payload so temporary network failures do not lose the latest sample.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// WiFi credentials
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Supabase REST configuration. Use the anon key only, never the service_role key.
const char* SUPABASE_URL = "https://your-project.supabase.co";
const char* SUPABASE_ANON_KEY = "your-supabase-anon-key";
const char* DEVICE_ID = "silo-1";

// Sensor pins from the current hardware wiring
#define DHTPIN 4
#define DHTTYPE DHT11
const int FAN_PIN = 23;
const int BUZZER_PIN = 22;
const int MQ135_PIN = 33;
const int SOIL_PIN = 34;

// Set true for common active-low relay modules, false for direct active-high
// modules/transistors.
const bool ACTUATOR_ACTIVE_LOW = false;
#define LED_PIN 2

// Threshold values. Keep aligned with src/lib/thresholds.ts.
#define TEMP_WARNING 32.0
#define TEMP_DANGER 38.0
#define HUM_WARNING 70.0
#define HUM_DANGER 85.0
#define GAS_WARNING 200.0
#define GAS_DANGER 400.0
#define MOIST_WARNING 60.0
#define MOIST_DANGER 80.0

// Timing
#define SENSOR_READ_DELAY 2000
#define LIVE_UPDATE_INTERVAL 2000
#define HISTORY_INSERT_INTERVAL 60000
#define WIFI_TIMEOUT 20000
#define HTTP_TIMEOUT 5000

DHT dht(DHTPIN, DHTTYPE);

float temperature = 0.0;
float humidity = 0.0;
float gasPPM = 0.0;
float moisture = 0.0;

bool fanOn = false;
bool buzzerOn = false;
bool manualControl = false;

unsigned long lastReadTime = 0;
unsigned long lastLiveUpdateTime = 0;
unsigned long lastHistoryInsertTime = 0;

String retryPayload = "";
uint8_t retryCount = 0;

float normalizeScore(float value, float warning, float danger) {
  float low = warning * 0.5;
  float high = danger * 1.2;
  if (value <= low) return 0.0;
  if (value >= high) return 100.0;
  return ((value - low) / (high - low)) * 100.0;
}

float computeMRI(float temp, float hum, float gas, float moist) {
  float humScore = normalizeScore(hum, HUM_WARNING, HUM_DANGER);
  float tempScore = normalizeScore(temp, TEMP_WARNING, TEMP_DANGER);
  float gasScore = normalizeScore(gas, GAS_WARNING, GAS_DANGER);
  float moistScore = normalizeScore(moist, MOIST_WARNING, MOIST_DANGER);
  return (humScore * 0.4) + (tempScore * 0.3) + (gasScore * 0.2) + (moistScore * 0.1);
}

String riskLevel(float mri) {
  if (mri >= 75) return "Critical";
  if (mri >= 50) return "High";
  if (mri >= 25) return "Moderate";
  return "Low";
}

void applyActuators() {
  const int onLevel = ACTUATOR_ACTIVE_LOW ? LOW : HIGH;
  const int offLevel = ACTUATOR_ACTIVE_LOW ? HIGH : LOW;
  digitalWrite(FAN_PIN, fanOn ? onLevel : offLevel);
  digitalWrite(BUZZER_PIN, buzzerOn ? onLevel : offLevel);
}

void setup() {
  Serial.begin(115200);
  Serial.println();
  Serial.println("SiloGuard ESP32 v2.3");
  Serial.println("Live Supabase upsert + 1-minute history telemetry");

  pinMode(LED_PIN, OUTPUT);
  pinMode(FAN_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(MQ135_PIN, INPUT);
  pinMode(SOIL_PIN, INPUT);

  fanOn = false;
  buzzerOn = false;
  applyActuators();
  digitalWrite(LED_PIN, LOW);

  dht.begin();
  connectToWiFi();

  Serial.println("[BOOT] Warming sensors for 5 seconds");
  delay(5000);
  Serial.println("[BOOT] Ready");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Disconnected. Reconnecting.");
    connectToWiFi();
  }

  if (millis() - lastReadTime >= SENSOR_READ_DELAY) {
    readSensors();
    fetchActuatorCommand();
    if (!manualControl) {
      autoControlActuators();
    } else {
      applyActuators();
    }
    printDataCycle("READ");
    lastReadTime = millis();
  }

  if (millis() - lastLiveUpdateTime >= LIVE_UPDATE_INTERVAL) {
    sendLiveReading();
    lastLiveUpdateTime = millis();
  }

  if (millis() - lastHistoryInsertTime >= HISTORY_INSERT_INTERVAL) {
    retryQueuedPayload();
    sendHistoryReading();
    lastHistoryInsertTime = millis();
  }
}

void connectToWiFi() {
  Serial.print("[WiFi] Connecting to ");
  Serial.print(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long startTime = millis();

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));

    if (millis() - startTime > WIFI_TIMEOUT) {
      Serial.println();
      Serial.println("[WiFi] Connection timeout");
      return;
    }
  }

  Serial.println();
  Serial.print("[WiFi] Connected. IP=");
  Serial.println(WiFi.localIP());
  digitalWrite(LED_PIN, HIGH);
}

void readSensors() {
  float nextTemp = dht.readTemperature();
  float nextHum = dht.readHumidity();

  if (isnan(nextTemp) || isnan(nextHum)) {
    Serial.println("[SENSOR] DHT11 read failed. Keeping last value.");
  } else {
    temperature = nextTemp;
    humidity = nextHum;
  }

  int gasRaw = analogRead(MQ135_PIN);
  float voltage = gasRaw * (3.3 / 4095.0);
  gasPPM = constrain(voltage * 200.0, 0, 800);

  int moistRaw = analogRead(SOIL_PIN);
  int dryValue = 3500;
  int wetValue = 1000;
  moisture = constrain(map(moistRaw, dryValue, wetValue, 0, 100), 0, 100);
}

void autoControlActuators() {
  float mri = computeMRI(temperature, humidity, gasPPM, moisture);

  fanOn = (temperature > TEMP_WARNING) ||
          (humidity > HUM_WARNING) ||
          (moisture > MOIST_WARNING) ||
          (mri > 40);

  buzzerOn = (temperature > TEMP_DANGER) ||
             (humidity > HUM_DANGER) ||
             (gasPPM > GAS_DANGER) ||
             (moisture > MOIST_DANGER) ||
             (mri > 70);

  applyActuators();
}

String buildPayload() {
  StaticJsonDocument<384> doc;
  doc["device_id"] = DEVICE_ID;
  doc["temperature"] = round(temperature * 10) / 10.0;
  doc["humidity"] = round(humidity * 10) / 10.0;
  doc["gas_ppm"] = round(gasPPM * 10) / 10.0;
  doc["moisture"] = round(moisture * 10) / 10.0;
  doc["fan_on"] = fanOn;
  doc["buzzer_on"] = buzzerOn;
  int mri = round(computeMRI(temperature, humidity, gasPPM, moisture));
  doc["mri_score"] = mri;
  doc["risk_level"] = riskLevel(mri);

  String payload;
  serializeJson(doc, payload);
  return payload;
}

bool postPayload(String tableName, String payload, String label, bool upsert) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] " + label + " skipped. WiFi offline.");
    return false;
  }

  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/" + tableName;
  if (upsert) {
    url += "?on_conflict=device_id";
  }
  http.begin(url);
  http.setTimeout(HTTP_TIMEOUT);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  http.addHeader("Prefer", upsert ? "resolution=merge-duplicates,return=minimal" : "return=minimal");

  Serial.print("[HTTP] " + label + " upload... ");
  int httpCode = http.POST(payload);

  if (httpCode >= 200 && httpCode < 300) {
    Serial.println("OK " + String(httpCode));
    retryPayload = "";
    retryCount = 0;
    digitalWrite(LED_PIN, LOW);
    delay(80);
    digitalWrite(LED_PIN, HIGH);
    http.end();
    return true;
  }

  if (httpCode > 0) {
    Serial.println("FAIL " + String(httpCode) + " " + http.getString());
  } else {
    Serial.println("ERROR " + http.errorToString(httpCode));
  }

  http.end();
  return false;
}

void retryQueuedPayload() {
  if (retryPayload.length() == 0) return;
  if (retryCount >= 3) {
    Serial.println("[HTTP] Dropping queued payload after 3 retries");
    retryPayload = "";
    retryCount = 0;
    return;
  }

  retryCount++;
  postPayload("sensor_readings", retryPayload, "history retry #" + String(retryCount), false);
}

void sendLiveReading() {
  String payload = buildPayload();
  postPayload("current_sensor_readings", payload, "live", true);
}

void sendHistoryReading() {
  String payload = buildPayload();
  bool ok = postPayload("sensor_readings", payload, "history", false);
  if (!ok) {
    retryPayload = payload;
    retryCount = 0;
    Serial.println("[HTTP] Queued latest history payload for retry");
  }
}

void fetchActuatorCommand() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/actuator_commands?device_id=eq." + DEVICE_ID + "&select=device_id,fan_on,buzzer_on,control_mode,updated_at";
  http.begin(url);
  http.setTimeout(HTTP_TIMEOUT);
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);

  int httpCode = http.GET();
  if (httpCode != 200) {
    Serial.println("[CMD] Fetch failed HTTP " + String(httpCode));
    http.end();
    return;
  }

  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, http.getString());
  http.end();

  if (error) {
    Serial.println("[CMD] Invalid command JSON");
    return;
  }

  if (!doc.is<JsonArray>() || doc.size() == 0) {
    manualControl = false;
    return;
  }

  JsonObject command = doc[0];
  String controlMode = command["control_mode"] | "auto";
  manualControl = controlMode == "manual";

  if (manualControl) {
    fanOn = command["fan_on"].as<bool>();
    buzzerOn = command["buzzer_on"].as<bool>();
    applyActuators();
  }

  Serial.printf("[CMD] mode=%s fan=%s buzzer=%s\n",
                manualControl ? "manual" : "auto",
                fanOn ? "ON" : "OFF",
                buzzerOn ? "ON" : "OFF");
}

void printDataCycle(String label) {
  float mri = computeMRI(temperature, humidity, gasPPM, moisture);
  Serial.println("DATA," + label +
                 ",device=" + String(DEVICE_ID) +
                 ",temp_c=" + String(temperature, 1) +
                 ",humidity_pct=" + String(humidity, 1) +
                 ",gas_ppm=" + String(gasPPM, 0) +
                 ",moisture_pct=" + String(moisture, 1) +
                 ",mri=" + String(mri, 0) +
                 ",risk=" + riskLevel(mri) +
                 ",mode=" + String(manualControl ? "manual" : "auto") +
                 ",fan=" + String(fanOn ? "ON" : "OFF") +
                 ",buzzer=" + String(buzzerOn ? "ON" : "OFF") +
                 ",retry=" + String(retryPayload.length() > 0 ? "QUEUED" : "NONE"));
}

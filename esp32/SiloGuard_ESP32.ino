/*
 * ============================================================
 *  SiloGuard - Smart Rice Storage Monitoring System
 *  ESP32 Firmware v1.0
 * ============================================================
 *  University of Southern Mindanao
 *  College of Engineering and Information Technology
 *  IoT Research Project
 * 
 *  Sensors Used:
 *    - DHT22      → Temperature & Humidity
 *    - MQ-135     → Air Quality (Gas PPM)
 *    - Soil/Grain Moisture Sensor → Moisture Level
 *  
 *  Actuators:
 *    - Relay Module Ch1 → Exhaust Fan
 *    - Relay Module Ch2 → Buzzer/Alarm
 * 
 *  Backend: Supabase (PostgreSQL + Real-time)
 *  Dashboard: React + TypeScript + Tailwind CSS
 * ============================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// =============================================
//  USER CONFIGURATION - CHANGE THESE VALUES!
// =============================================

// WiFi Credentials
const char* WIFI_SSID     = "YOUR_WIFI_SSID";       // <-- Replace with your WiFi name
const char* WIFI_PASSWORD  = "YOUR_WIFI_PASSWORD";   // <-- Replace with your WiFi password

// Supabase Configuration
const char* SUPABASE_URL   = "https://sakkmmdymuslpuwzzzer.supabase.co";
const char* SUPABASE_KEY   = "sb_publishable_e341tTpvgJ1HIaFhUxL_NA_dO_sIJC2";

// =============================================
//  PIN DEFINITIONS
// =============================================

// Sensor Pins
#define DHT_PIN           4       // DHT22 data pin → GPIO4
#define DHT_TYPE          DHT22   // DHT sensor type
#define MQ135_PIN         34      // MQ-135 analog output → GPIO34 (ADC1_CH6)
#define MOISTURE_PIN      35      // Moisture sensor analog → GPIO35 (ADC1_CH7)

// Actuator Pins
#define FAN_RELAY_PIN     26      // Fan relay control → GPIO26
#define BUZZER_RELAY_PIN  27      // Buzzer relay control → GPIO27

// Status LED (built-in)
#define LED_PIN           2       // Built-in LED on most ESP32 boards

// =============================================
//  THRESHOLD VALUES (must match dashboard!)
// =============================================
#define TEMP_WARNING      32.0    // Temperature warning threshold (°C)
#define TEMP_DANGER       38.0    // Temperature danger threshold (°C)
#define HUM_WARNING       70.0    // Humidity warning threshold (%)
#define HUM_DANGER        85.0    // Humidity danger threshold (%)
#define GAS_WARNING       200.0   // Gas PPM warning threshold
#define GAS_DANGER        400.0   // Gas PPM danger threshold
#define MOIST_WARNING     60.0    // Moisture warning threshold (%)
#define MOIST_DANGER      80.0    // Moisture danger threshold (%)

// =============================================
//  TIMING CONFIGURATION
// =============================================
#define SEND_INTERVAL     10000   // Send data every 10 seconds (in ms)
#define SENSOR_READ_DELAY 2000    // Wait 2s between sensor reads for stability
#define WIFI_TIMEOUT      20000   // WiFi connection timeout (20 seconds)

// =============================================
//  GLOBAL OBJECTS & VARIABLES
// =============================================

DHT dht(DHT_PIN, DHT_TYPE);

// Sensor values
float temperature = 0.0;
float humidity    = 0.0;
float gasPPM      = 0.0;
float moisture    = 0.0;

// Actuator states
bool fanOn    = false;
bool buzzerOn = false;

// Timing
unsigned long lastSendTime = 0;
unsigned long lastReadTime = 0;

// =============================================
//  MRI (Mold Risk Index) CALCULATION
//  Same formula used in the dashboard
// =============================================
float normalizeScore(float value, float warning, float danger) {
  float low  = warning * 0.5;
  float high = danger * 1.2;
  if (value <= low)  return 0.0;
  if (value >= high) return 100.0;
  return ((value - low) / (high - low)) * 100.0;
}

float computeMRI(float temp, float hum, float gas, float moist) {
  float humScore   = normalizeScore(hum,   HUM_WARNING,   HUM_DANGER);
  float tempScore  = normalizeScore(temp,  TEMP_WARNING,  TEMP_DANGER);
  float gasScore   = normalizeScore(gas,   GAS_WARNING,   GAS_DANGER);
  float moistScore = normalizeScore(moist, MOIST_WARNING, MOIST_DANGER);
  
  return (humScore * 0.4) + (tempScore * 0.3) + (gasScore * 0.2) + (moistScore * 0.1);
}

// =============================================
//  SETUP
// =============================================
void setup() {
  Serial.begin(115200);
  Serial.println("\n========================================");
  Serial.println("  SiloGuard ESP32 - Starting Up...");
  Serial.println("  Smart Rice Storage Monitoring System");
  Serial.println("========================================\n");

  // Initialize pins
  pinMode(LED_PIN, OUTPUT);
  pinMode(FAN_RELAY_PIN, OUTPUT);
  pinMode(BUZZER_RELAY_PIN, OUTPUT);
  pinMode(MQ135_PIN, INPUT);
  pinMode(MOISTURE_PIN, INPUT);

  // Set actuators OFF initially (HIGH = OFF for active-low relays)
  digitalWrite(FAN_RELAY_PIN, HIGH);
  digitalWrite(BUZZER_RELAY_PIN, HIGH);
  digitalWrite(LED_PIN, LOW);

  // Initialize DHT sensor
  dht.begin();
  Serial.println("[OK] DHT22 sensor initialized");

  // Connect to WiFi
  connectToWiFi();

  // Small delay for sensors to warm up
  Serial.println("[INFO] Warming up sensors (5 seconds)...");
  delay(5000);
  Serial.println("[OK] Sensors ready!\n");
}

// =============================================
//  MAIN LOOP
// =============================================
void loop() {
  // Make sure WiFi is still connected
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WARN] WiFi disconnected! Reconnecting...");
    connectToWiFi();
  }

  // Read sensors every SENSOR_READ_DELAY ms
  if (millis() - lastReadTime >= SENSOR_READ_DELAY) {
    readSensors();
    checkThresholds();  // Auto-control actuators based on readings
    lastReadTime = millis();
  }

  // Send data to Supabase every SEND_INTERVAL ms
  if (millis() - lastSendTime >= SEND_INTERVAL) {
    sendToSupabase();
    lastSendTime = millis();
  }
}

// =============================================
//  WiFi CONNECTION
// =============================================
void connectToWiFi() {
  Serial.print("[WiFi] Connecting to ");
  Serial.print(WIFI_SSID);
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  unsigned long startTime = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));  // Blink LED while connecting
    
    if (millis() - startTime > WIFI_TIMEOUT) {
      Serial.println("\n[ERROR] WiFi connection FAILED! Check SSID/password.");
      Serial.println("[INFO] Will retry in next loop iteration...");
      return;
    }
  }
  
  Serial.println();
  Serial.println("[OK] WiFi Connected!");
  Serial.print("[OK] IP Address: ");
  Serial.println(WiFi.localIP());
  digitalWrite(LED_PIN, HIGH);  // Solid LED = connected
}

// =============================================
//  READ ALL SENSORS
// =============================================
void readSensors() {
  // --- DHT22: Temperature & Humidity ---
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  
  if (isnan(t) || isnan(h)) {
    Serial.println("[WARN] DHT22 read failed! Using last known values.");
  } else {
    temperature = t;
    humidity = h;
  }

  // --- MQ-135: Gas/Air Quality ---
  // Read analog value (0-4095 on ESP32's 12-bit ADC)
  int gasRaw = analogRead(MQ135_PIN);
  
  // Convert raw ADC to approximate PPM
  // Note: For accurate readings, you need to calibrate your specific MQ-135 sensor
  // This is a simplified conversion formula. 
  // The MQ-135 datasheet has detailed calibration curves.
  // For a school project, this approximation is fine.
  float voltage = gasRaw * (3.3 / 4095.0);
  gasPPM = voltage * 200.0;  // Simplified: adjust multiplier based on your calibration
  
  // Clamp to reasonable range
  if (gasPPM < 0) gasPPM = 0;
  if (gasPPM > 800) gasPPM = 800;

  // --- Moisture Sensor ---
  // Read analog value (0-4095)
  int moistRaw = analogRead(MOISTURE_PIN);
  
  // Convert to percentage (inverted - dry = high ADC, wet = low ADC)
  // Adjust these min/max values based on your specific sensor calibration
  int dryValue = 3500;   // ADC reading when sensor is completely dry
  int wetValue = 1000;   // ADC reading when sensor is completely wet
  moisture = map(moistRaw, dryValue, wetValue, 0, 100);
  moisture = constrain(moisture, 0, 100);

  // --- Print readings to Serial Monitor ---
  Serial.println("─── Sensor Readings ───────────────────");
  Serial.printf("  Temperature : %.1f °C\n", temperature);
  Serial.printf("  Humidity    : %.1f %%\n", humidity);
  Serial.printf("  Gas (MQ-135): %.1f ppm\n", gasPPM);
  Serial.printf("  Moisture    : %.1f %%\n", moisture);
  
  float mri = computeMRI(temperature, humidity, gasPPM, moisture);
  Serial.printf("  MRI Score   : %.0f / 100\n", mri);
  Serial.printf("  Fan: %s | Buzzer: %s\n", fanOn ? "ON" : "OFF", buzzerOn ? "ON" : "OFF");
  Serial.println("───────────────────────────────────────");
}

// =============================================
//  AUTO-CONTROL ACTUATORS (THRESHOLD CHECK)
// =============================================
void checkThresholds() {
  float mri = computeMRI(temperature, humidity, gasPPM, moisture);
  
  // --- Fan Control ---
  // Turn ON fan if any parameter exceeds WARNING level
  bool shouldFan = (temperature > TEMP_WARNING) || 
                   (humidity > HUM_WARNING) || 
                   (moisture > MOIST_WARNING) ||
                   (mri > 40);  // MRI above 40 = moderate risk
  
  if (shouldFan && !fanOn) {
    fanOn = true;
    digitalWrite(FAN_RELAY_PIN, LOW);  // LOW = ON for active-low relay
    Serial.println("[ACTUATOR] Fan turned ON - threshold exceeded!");
    sendAlert("Fan Activated", getWorstSensor(), getWorstValue(), mri);
  } else if (!shouldFan && fanOn) {
    fanOn = false;
    digitalWrite(FAN_RELAY_PIN, HIGH);  // HIGH = OFF
    Serial.println("[ACTUATOR] Fan turned OFF - readings normal.");
  }

  // --- Buzzer Control ---
  // Sound buzzer only at DANGER level
  bool shouldBuzz = (temperature > TEMP_DANGER) || 
                    (humidity > HUM_DANGER) || 
                    (gasPPM > GAS_DANGER) || 
                    (moisture > MOIST_DANGER) ||
                    (mri > 70);  // MRI above 70 = critical
  
  if (shouldBuzz && !buzzerOn) {
    buzzerOn = true;
    digitalWrite(BUZZER_RELAY_PIN, LOW);
    Serial.println("[ACTUATOR] BUZZER ON - DANGER level reached!");
    sendAlert("Buzzer Triggered", getWorstSensor(), getWorstValue(), mri);
  } else if (!shouldBuzz && buzzerOn) {
    buzzerOn = false;
    digitalWrite(BUZZER_RELAY_PIN, HIGH);
    Serial.println("[ACTUATOR] Buzzer OFF - levels back to safe.");
  }
}

// Helper: Find which sensor is in the worst state
String getWorstSensor() {
  if (temperature > TEMP_DANGER) return "temperature";
  if (humidity > HUM_DANGER) return "humidity";
  if (gasPPM > GAS_DANGER) return "gas_ppm";
  if (moisture > MOIST_DANGER) return "moisture";
  if (temperature > TEMP_WARNING) return "temperature";
  if (humidity > HUM_WARNING) return "humidity";
  if (gasPPM > GAS_WARNING) return "gas_ppm";
  if (moisture > MOIST_WARNING) return "moisture";
  return "unknown";
}

float getWorstValue() {
  String sensor = getWorstSensor();
  if (sensor == "temperature") return temperature;
  if (sensor == "humidity") return humidity;
  if (sensor == "gas_ppm") return gasPPM;
  if (sensor == "moisture") return moisture;
  return 0;
}

// =============================================
//  SEND SENSOR DATA TO SUPABASE
// =============================================
void sendToSupabase() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[ERROR] WiFi not connected - cannot send data!");
    return;
  }

  HTTPClient http;
  
  // Build the Supabase REST API URL for inserting into sensor_readings table
  String url = String(SUPABASE_URL) + "/rest/v1/sensor_readings";
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  http.addHeader("Prefer", "return=minimal");

  // Build JSON payload
  StaticJsonDocument<256> doc;
  doc["temperature"] = round(temperature * 10) / 10.0;  // 1 decimal place
  doc["humidity"]    = round(humidity * 10) / 10.0;
  doc["gas_ppm"]     = round(gasPPM * 10) / 10.0;
  doc["moisture"]    = round(moisture * 10) / 10.0;
  doc["fan_on"]      = fanOn;
  doc["buzzer_on"]   = buzzerOn;
  
  String jsonPayload;
  serializeJson(doc, jsonPayload);

  Serial.print("[HTTP] Sending data to Supabase... ");
  int httpCode = http.POST(jsonPayload);

  if (httpCode > 0) {
    if (httpCode == 201 || httpCode == 200) {
      Serial.println("SUCCESS! (" + String(httpCode) + ")");
      // Blink LED to indicate successful send
      digitalWrite(LED_PIN, LOW);
      delay(100);
      digitalWrite(LED_PIN, HIGH);
    } else {
      Serial.println("FAILED! HTTP " + String(httpCode));
      Serial.println("  Response: " + http.getString());
    }
  } else {
    Serial.println("CONNECTION ERROR: " + http.errorToString(httpCode));
  }
  
  http.end();
}

// =============================================
//  SEND ALERT TO SUPABASE
// =============================================
void sendAlert(String type, String sensor, float value, float mriScore) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/alerts";
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  http.addHeader("Prefer", "return=minimal");

  StaticJsonDocument<256> doc;
  doc["type"]      = type;
  doc["sensor"]    = sensor;
  doc["value"]     = round(value * 10) / 10.0;
  doc["mri_score"] = round(mriScore);
  
  String jsonPayload;
  serializeJson(doc, jsonPayload);

  int httpCode = http.POST(jsonPayload);
  
  if (httpCode == 201 || httpCode == 200) {
    Serial.println("[ALERT] Alert sent: " + type + " on " + sensor);
  } else {
    Serial.println("[ALERT] Failed to send alert: HTTP " + String(httpCode));
  }
  
  http.end();
}

import Foundation

@objc(NokeAPIClient)
class NokeAPIClient: NSObject {
    
    // MARK: - Properties
    
    private var baseURL: String = "https://router.smartentry.noke.dev/"
    private var authToken: String?
    private var userUUID: String?
    
    // MARK: - Configuration
    
    @objc(setEnvironment:resolve:reject:)
    func setEnvironment(_ environment: String,
                       resolve: @escaping RCTPromiseResolveBlock,
                       reject: @escaping RCTPromiseRejectBlock) {
        
        switch environment.lowercased() {
        case "production", "prod":
            baseURL = "https://router.smartentry.noke.com/"
        case "development", "dev":
            baseURL = "https://router.smartentry.noke.dev/"
        default:
            baseURL = environment // URL personalizada
        }
        
        NSLog("[NokeAPIClient] Environment set to: %@", baseURL)
        resolve(baseURL)
    }
    
    // MARK: - Authentication
    
    @objc(login:password:companyUUID:siteUUID:deviceId:resolve:reject:)
    func login(_ email: String,
              password: String,
              companyUUID: String,
              siteUUID: String,
              deviceId: String,
              resolve: @escaping RCTPromiseResolveBlock,
              reject: @escaping RCTPromiseRejectBlock) {
        
        NSLog("[NokeAPIClient] Login attempt for: %@", email)
        
        guard let url = URL(string: "\(baseURL)login/") else {
            reject("INVALID_URL", "Invalid base URL", nil)
            return
        }
        
        let body: [String: Any] = [
            "email": email,
            "password": password,
            "companyUUID": companyUUID,
            "deviceUUID": deviceId,
            "siteUUID": siteUUID
        ]
        
        performRequest(url: url, method: "POST", body: body, authorized: false) { [weak self] result in
            switch result {
            case .success(let data):
                do {
                    if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                        
                        // Log complete login response
                        if let jsonData = try? JSONSerialization.data(withJSONObject: json, options: .prettyPrinted),
                           let jsonString = String(data: jsonData, encoding: .utf8) {
                            print("[NokeAPIClient] 📋 LOGIN RESPONSE:")
                            print(jsonString)
                        }
                        
                        // Guardar token (campo "token" no "authToken")
                        if let token = json["token"] as? String {
                            self?.authToken = token
                        }
                        
                        // Extraer userUUID de data object
                        var extractedUserUUID = ""
                        if let userData = json["data"] as? [String: Any] {
                            if let uuid = userData["userUUID"] as? String, !uuid.isEmpty {
                                extractedUserUUID = uuid
                            } else if let userId = userData["id"] as? Int {
                                extractedUserUUID = String(userId)
                            }
                        }
                        self?.userUUID = extractedUserUUID
                        
                        print("[NokeAPIClient] ✅ Login successful")
                        print("[NokeAPIClient]    Auth Token: \(String((self?.authToken ?? "").prefix(30)))")
                        print("[NokeAPIClient]    User UUID: \(self?.userUUID ?? "N/A")")
                        
                        // Extraer defaultSiteUUID del objeto data también
                        var defaultSite = siteUUID
                        if let userData = json["data"] as? [String: Any],
                           let site = userData["defaultSiteUUID"] as? String, !site.isEmpty {
                            defaultSite = site
                        }
                        
                        // Devolver datos completos
                        let response: [String: Any] = [
                            "authToken": self?.authToken ?? "",
                            "userUUID": self?.userUUID ?? "",
                            "siteUUID": defaultSite,
                            "companyUUID": companyUUID,
                            "email": email
                        ]
                        
                        resolve(response)
                    } else {
                        reject("PARSE_ERROR", "Failed to parse login response", nil)
                    }
                } catch {
                    reject("JSON_ERROR", error.localizedDescription, error)
                }
                
            case .failure(let error):
                NSLog("[NokeAPIClient] ❌ Login failed: %@", error.localizedDescription)
                reject("LOGIN_FAILED", error.localizedDescription, error)
            }
        }
    }
    
    // MARK: - Offline Keys
    
    @objc(getAllOfflineKeys:companyUUID:siteUUID:resolve:reject:)
    func getAllOfflineKeys(_ userUUID: String,
                          companyUUID: String,
                          siteUUID: String,
                          resolve: @escaping RCTPromiseResolveBlock,
                          reject: @escaping RCTPromiseRejectBlock) {
        
        print("[NokeAPIClient] 📤 Getting locks from user/locks/...")
        
        guard let url = URL(string: "\(baseURL)user/locks/") else {
            reject("INVALID_URL", "Invalid base URL", nil)
            return
        }
        
        // Este endpoint usa body vacío
        let body: [String: Any] = [:]
        
        print("[NokeAPIClient] 📤 Using endpoint: user/locks/ (empty body)")
        
        performRequest(url: url, method: "POST", body: body, authorized: true) { result in
            switch result {
            case .success(let data):
                do {
                    if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                        
                        // ALWAYS log the complete response for debugging
                        print("[NokeAPIClient] 📥 GETLOCKSBYUSER RESPONSE:")
                        if let jsonData = try? JSONSerialization.data(withJSONObject: json, options: .prettyPrinted),
                           let jsonString = String(data: jsonData, encoding: .utf8) {
                            print(jsonString)
                        }
                        
                        // Procesar unidades y dispositivos
                        var offlineKeys: [String: [String: Any]] = [:]
                        var totalDevices = 0
                        var devicesWithKeys = 0
                        
                        // La estructura es: data.units[].locks[]
                        if let dataObj = json["data"] as? [String: Any],
                           let units = dataObj["units"] as? [[String: Any]] {
                            
                            for unit in units {
                                let unitNumber = unit["name"] as? String ?? ""
                                let unitUUID = unit["uuid"] as? String ?? ""
                                
                                if let devices = unit["locks"] as? [[String: Any]] {
                                    for device in devices {
                                        totalDevices += 1
                                        
                                        guard let mac = device["mac"] as? String else { continue }
                                        
                                        // Obtener offline key (puede estar en offlineKey o offlineKeyObj)
                                        var offlineKey: String?
                                        if let key = device["offlineKey"] as? String, !key.isEmpty {
                                            offlineKey = key
                                        } else if let keyObj = device["offlineKeyObj"] as? [String: Any],
                                                  let key = keyObj["offlineKey"] as? String, !key.isEmpty {
                                            offlineKey = key
                                        }
                                        
                                        guard let key = offlineKey,
                                              let unlockCmd = device["unlockCmd"] as? String,
                                              !key.isEmpty, !unlockCmd.isEmpty else {
                                            continue
                                        }
                                        
                                        devicesWithKeys += 1
                                        
                                        // Crear objeto del dispositivo
                                        var deviceData: [String: Any] = [
                                            "mac": mac,
                                            "name": device["name"] as? String ?? "Unknown",
                                            "uuid": device["uuid"] as? String ?? "",
                                            "offlineKey": key,
                                            "unlockCmd": unlockCmd,
                                            "unitNumber": unitNumber,
                                            "unitUUID": unitUUID
                                        ]
                                        
                                        // Campos opcionales
                                        if let scheduledCmd = device["scheduledUnlockCmd"] as? String {
                                            deviceData["scheduledUnlockCmd"] = scheduledCmd
                                        }
                                        if let keyObj = device["offlineKeyObj"] as? [String: Any],
                                           let expiration = keyObj["offlineExpiration"] as? String {
                                            deviceData["offlineExpiration"] = expiration
                                        }
                                        if let battery = device["battery"] as? Int {
                                            deviceData["battery"] = battery
                                        }
                                        if let temp = device["temperature"] as? Int {
                                            deviceData["temperature"] = temp
                                        }
                                        if let hwType = device["hwType"] as? String {
                                            deviceData["hwType"] = hwType
                                        }
                                        
                                        offlineKeys[mac] = deviceData
                                    }
                                }
                            }
                        }
                        
                        NSLog("[NokeAPIClient] ✅ Offline keys obtained")
                        NSLog("[NokeAPIClient]    Total devices: %d", totalDevices)
                        NSLog("[NokeAPIClient]    Devices with keys: %d", devicesWithKeys)
                        
                        // Debug: Log details when no devices found
                        if totalDevices == 0 {
                            print("[NokeAPIClient] ⚠️  No locks found in response")
                            
                            if let dataObj = json["data"] as? [String: Any],
                               let units = dataObj["units"] as? [[String: Any]] {
                                print("[NokeAPIClient]    Total units in response: \(units.count)")
                                for (index, unit) in units.enumerated() {
                                    let unitName = unit["name"] as? String ?? "N/A"
                                    print("[NokeAPIClient]    Unit \(index): \(unitName)")
                                    if let locks = unit["locks"] as? [[String: Any]] {
                                        print("[NokeAPIClient]       Locks in unit: \(locks.count)")
                                        for lock in locks {
                                            let mac = lock["mac"] as? String ?? "N/A"
                                            let name = lock["name"] as? String ?? "N/A"
                                            print("[NokeAPIClient]       - MAC: \(mac), Name: \(name)")
                                            
                                            let offlineKey = lock["offlineKey"] as? String ?? ""
                                            let unlockCmd = lock["unlockCmd"] as? String ?? ""
                                            print("[NokeAPIClient]         offlineKey: '\(offlineKey.isEmpty ? "EMPTY" : "HAS_VALUE")'")
                                            print("[NokeAPIClient]         unlockCmd: '\(unlockCmd.isEmpty ? "EMPTY" : "HAS_VALUE")'")
                                        }
                                    } else {
                                        print("[NokeAPIClient]       No 'locks' array in this unit")
                                    }
                                }
                            } else {
                                print("[NokeAPIClient]    No 'data.units' array in response")
                            }
                        }
                        
                        resolve(offlineKeys)
                    } else {
                        reject("PARSE_ERROR", "Failed to parse response", nil)
                    }
                } catch {
                    reject("JSON_ERROR", error.localizedDescription, error)
                }
                
            case .failure(let error):
                NSLog("[NokeAPIClient] ❌ Failed to get offline keys: %@", error.localizedDescription)
                reject("API_ERROR", error.localizedDescription, error)
            }
        }
    }
    
    // MARK: - Online Unlock Commands
    
    @objc(getUnlockCommands:session:resolve:reject:)
    func getUnlockCommands(_ mac: String,
                          session: String,
                          resolve: @escaping RCTPromiseResolveBlock,
                          reject: @escaping RCTPromiseRejectBlock) {
        
        NSLog("[NokeAPIClient] Getting unlock commands for: %@", mac)
        
        guard let url = URL(string: "\(baseURL)lock/unlock/") else {
            reject("INVALID_URL", "Invalid base URL", nil)
            return
        }
        
        let body: [String: Any] = [
            "session": session,
            "mac": mac
        ]
        
        performRequest(url: url, method: "POST", body: body, authorized: true) { result in
            switch result {
            case .success(let data):
                do {
                    if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                        
                        // Log complete response for debugging
                        print("[NokeAPIClient] 📥 UNLOCK RESPONSE:")
                        if let jsonData = try? JSONSerialization.data(withJSONObject: json, options: .prettyPrinted),
                           let jsonString = String(data: jsonData, encoding: .utf8) {
                            print(jsonString)
                        }
                        
                        // Check if response indicates an error
                        if let result = json["result"] as? String, result == "failure" {
                            let errorMessage = json["message"] as? String ?? "Unknown error"
                            let errorCode = json["errorCode"] as? Int ?? -1
                            print("[NokeAPIClient] ❌ API returned error: \(errorMessage) (code: \(errorCode))")
                            reject("API_ERROR", errorMessage, nil)
                            return
                        }
                        
                        // Try to extract commands from different possible structures
                        var commandsArray: [String]? = nil
                        
                        // Try: json.commands
                        if let commands = json["commands"] as? [String] {
                            commandsArray = commands
                        }
                        // Try: json.data.commands
                        else if let data = json["data"] as? [String: Any],
                                let commands = data["commands"] as? [String] {
                            commandsArray = commands
                        }
                        
                        if let commands = commandsArray, !commands.isEmpty {
                            let commandString = commands.joined(separator: "+")
                            
                            print("[NokeAPIClient] ✅ Unlock commands received: \(commands.count) commands")
                            
                            resolve([
                                "commandString": commandString,
                                "commands": commands
                            ])
                        } else {
                            print("[NokeAPIClient] ❌ No 'commands' array found in response")
                            print("[NokeAPIClient] Response keys: \(Array(json.keys).joined(separator: ", "))")
                            
                            // Return the full JSON for debugging
                            reject("PARSE_ERROR", "No commands found in response. See logs for details.", nil)
                        }
                    } else {
                        reject("PARSE_ERROR", "Failed to parse response as JSON", nil)
                    }
                } catch {
                    reject("JSON_ERROR", error.localizedDescription, error)
                }
                
            case .failure(let error):
                NSLog("[NokeAPIClient] ❌ Failed to get unlock commands: %@", error.localizedDescription)
                reject("API_ERROR", error.localizedDescription, error)
            }
        }
    }
    
    // MARK: - Support Commands
    
    @objc(getSupportCommands:reject:)
    func getSupportCommands(_ resolve: @escaping RCTPromiseResolveBlock,
                           reject: @escaping RCTPromiseRejectBlock) {
        
        NSLog("[NokeAPIClient] Getting support commands...")
        
        guard let url = URL(string: "\(baseURL)support/lockcmds/") else {
            reject("INVALID_URL", "Invalid base URL", nil)
            return
        }
        
        performRequest(url: url, method: "GET", body: nil, authorized: true) { result in
            switch result {
            case .success(let data):
                do {
                    if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                       let locks = json["locks"] as? [[String: Any]] {
                        
                        NSLog("[NokeAPIClient] ✅ Support commands received")
                        NSLog("[NokeAPIClient]    Total locks: %d", locks.count)
                        
                        resolve(locks)
                    } else {
                        reject("PARSE_ERROR", "Failed to parse support commands", nil)
                    }
                } catch {
                    reject("JSON_ERROR", error.localizedDescription, error)
                }
                
            case .failure(let error):
                NSLog("[NokeAPIClient] ❌ Failed to get support commands: %@", error.localizedDescription)
                reject("API_ERROR", error.localizedDescription, error)
            }
        }
    }
    
    // MARK: - Locate
    
    @objc(locateLock:resolve:reject:)
    func locateLock(_ lockUUID: String,
                   resolve: @escaping RCTPromiseResolveBlock,
                   reject: @escaping RCTPromiseRejectBlock) {
        
        NSLog("[NokeAPIClient] Locate lock: %@", lockUUID)
        
        guard let url = URL(string: "\(baseURL)lock/locate/") else {
            reject("INVALID_URL", "Invalid base URL", nil)
            return
        }
        
        let body: [String: Any] = [
            "lockUUID": lockUUID
        ]
        
        performRequest(url: url, method: "POST", body: body, authorized: true) { result in
            switch result {
            case .success(_):
                NSLog("[NokeAPIClient] ✅ Locate command sent")
                resolve(true)
                
            case .failure(let error):
                NSLog("[NokeAPIClient] ❌ Failed to locate lock: %@", error.localizedDescription)
                reject("API_ERROR", error.localizedDescription, error)
            }
        }
    }
    
    // MARK: - Token Management
    
    @objc(getAuthToken:reject:)
    func getAuthToken(_ resolve: @escaping RCTPromiseResolveBlock,
                     reject: @escaping RCTPromiseRejectBlock) {
        resolve(authToken ?? "")
    }
    
    @objc(setAuthToken:resolve:reject:)
    func setAuthToken(_ token: String,
                     resolve: @escaping RCTPromiseResolveBlock,
                     reject: @escaping RCTPromiseRejectBlock) {
        authToken = token
        NSLog("[NokeAPIClient] Auth token set")
        resolve(true)
    }
    
    @objc(clearAuthToken:reject:)
    func clearAuthToken(_ resolve: @escaping RCTPromiseResolveBlock,
                       reject: @escaping RCTPromiseRejectBlock) {
        authToken = nil
        userUUID = nil
        NSLog("[NokeAPIClient] Auth token cleared")
        resolve(true)
    }
    
    // MARK: - Helper Methods
    
    private func performRequest(url: URL,
                               method: String,
                               body: [String: Any]?,
                               authorized: Bool,
                               completion: @escaping (Result<Data, Error>) -> Void) {
        
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        
        // Add authorization if needed
        if authorized, let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        // Add body if present
        if let body = body {
            do {
                request.httpBody = try JSONSerialization.data(withJSONObject: body)
            } catch {
                completion(.failure(error))
                return
            }
        }
        
        // Generate and log curl command
        logCurlCommand(for: request)
        
        // Perform request
        let task = URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse else {
                completion(.failure(NSError(domain: "NokeAPIClient", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid response"])))
                return
            }
            
            NSLog("[NokeAPIClient] 📥 Response: %d", httpResponse.statusCode)
            
            guard let data = data else {
                completion(.failure(NSError(domain: "NokeAPIClient", code: -1, userInfo: [NSLocalizedDescriptionKey: "No data received"])))
                return
            }
            
            // Log response for debugging
            if let jsonString = String(data: data, encoding: .utf8) {
                NSLog("[NokeAPIClient]    Response data: %@", jsonString)
            }
            
            // Check status code
            guard (200...299).contains(httpResponse.statusCode) else {
                if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let message = json["message"] as? String {
                    completion(.failure(NSError(domain: "NokeAPIClient", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: message])))
                } else {
                    completion(.failure(NSError(domain: "NokeAPIClient", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "HTTP \(httpResponse.statusCode)"])))
                }
                return
            }
            
            completion(.success(data))
        }
        
        task.resume()
    }
    
    // MARK: - Debug Helpers
    
    private func logCurlCommand(for request: URLRequest) {
        guard let url = request.url?.absoluteString,
              let method = request.httpMethod else {
            return
        }
        
        var curlCommand = "curl -X \(method) '\(url)'"
        
        // Add headers
        if let headers = request.allHTTPHeaderFields {
            for (key, value) in headers {
                curlCommand += " \\\n  -H '\(key): \(value)'"
            }
        }
        
        // Add body
        if let bodyData = request.httpBody,
           let bodyString = String(data: bodyData, encoding: .utf8) {
            // Escape single quotes in the body
            let escapedBody = bodyString.replacingOccurrences(of: "'", with: "'\\''")
            curlCommand += " \\\n  -d '\(escapedBody)'"
        }
        
        print("\n[NokeAPIClient] 🔧 CURL COMMAND:")
        print("─────────────────────────────────────────────────────────")
        print(curlCommand)
        print("─────────────────────────────────────────────────────────\n")
    }
    
    // MARK: - Required for RCTBridgeModule
    
    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }
}


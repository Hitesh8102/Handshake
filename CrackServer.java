package com.wificracker;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.socket.config.annotation.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

@SpringBootApplication
@EnableWebSocket
@EnableScheduling
public class CrackServer {
    public static void main(String[] args) {
        SpringApplication.run(CrackServer.class, args);
    }
}

// WebSocket Configuration
@Configuration
class WebSocketConfig implements WebSocketConfigurer {
    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(new ProgressHandler(), "/ws/progress")
                .setAllowedOrigins("*");
    }
}

// WebSocket Handler
class ProgressHandler extends TextWebSocketHandler {
    private static final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();
    private static final ObjectMapper mapper = new ObjectMapper();
    
    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.add(session);
    }
    
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session);
    }
    
    public static void broadcast(Object message) {
        try {
            String json = mapper.writeValueAsString(message);
            sessions.forEach(session -> {
                try {
                    session.sendMessage(new TextMessage(json));
                } catch (IOException e) {
                    e.printStackTrace();
                }
            });
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}

// REST Controller
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
class CrackController {
    
    private final CrackService crackService;
    
    public CrackController() {
        this.crackService = new CrackService();
    }
    
    @PostMapping("/analyze")
    public ResponseEntity<Map<String, Object>> analyzeFile(
            @RequestParam("file") MultipartFile file) {
        
        Map<String, Object> response = new HashMap<>();
        
        try {
            Path tempDir = Files.createTempDirectory("crack_");
            Path filePath = tempDir.resolve(file.getOriginalFilename());
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);
            
            List<NetworkInfo> networks = crackService.analyzeCapture(filePath.toString());
            
            response.put("success", true);
            response.put("networks", networks);
            SessionData.setCurrentFile(filePath.toString());
            
        } catch (Exception e) {
            response.put("success", false);
            response.put("error", e.getMessage());
        }
        
        return ResponseEntity.ok(response);
    }
    
    @PostMapping("/start")
    public ResponseEntity<Map<String, Object>> startAttack(@RequestBody CrackRequest request) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            String captureFile = SessionData.getCurrentFile();
            if (captureFile == null) {
                response.put("success", false);
                response.put("error", "No capture file uploaded");
                return ResponseEntity.ok(response);
            }
            
            crackService.startAttack(request, captureFile);
            response.put("success", true);
            
        } catch (Exception e) {
            response.put("success", false);
            response.put("error", e.getMessage());
        }
        
        return ResponseEntity.ok(response);
    }
    
    @GetMapping("/status")
    public ResponseEntity<AttackStatus> getStatus() {
        return ResponseEntity.ok(crackService.getStatus());
    }
    
    @PostMapping("/pause")
    public ResponseEntity<Map<String, Object>> pause() {
        crackService.pause();
        return ResponseEntity.ok(Map.of("success", true));
    }
    
    @PostMapping("/resume")
    public ResponseEntity<Map<String, Object>> resume() {
        crackService.resume();
        return ResponseEntity.ok(Map.of("success", true));
    }
    
    @PostMapping("/stop")
    public ResponseEntity<Map<String, Object>> stop() {
        crackService.stop();
        return ResponseEntity.ok(Map.of("success", true));
    }
}

// Service Class
@Service
class CrackService {
    private final PasswordGenerator passwordGenerator;
    private final AtomicBoolean isRunning = new AtomicBoolean(false);
    private final AtomicBoolean isPaused = new AtomicBoolean(false);
    private final AtomicLong testedCount = new AtomicLong(0);
    private final AtomicLong startTime = new AtomicLong(0);
    private volatile String currentPassword = "";
    private volatile String foundPassword = null;
    private Thread attackThread;
    
    public CrackService() {
        this.passwordGenerator = new PasswordGenerator();
    }
    
    public List<NetworkInfo> analyzeCapture(String filePath) throws Exception {
        // Parse .cap file using external tool or library
        List<NetworkInfo> networks = new ArrayList<>();
        
        // This would integrate with aircrack-ng or similar
        ProcessBuilder pb = new ProcessBuilder(
            "airodump-ng", 
            "-r", filePath,
            "--output-format", "csv",
            "-w", "/tmp/analysis"
        );
        
        // For demo, return mock data
        networks.add(new NetworkInfo("TestNetwork", "AA:BB:CC:DD:EE:FF", "WPA2", -45));
        
        return networks;
    }
    
    public void startAttack(CrackRequest config, String captureFile) {
        if (isRunning.get()) {
            throw new IllegalStateException("Attack already running");
        }
        
        isRunning.set(true);
        isPaused.set(false);
        testedCount.set(0);
        startTime.set(System.currentTimeMillis());
        foundPassword = null;
        
        attackThread = new Thread(() -> {
            try {
                Iterator<String> passwords = passwordGenerator.generate(config);
                
                while (isRunning.get() && passwords.hasNext()) {
                    if (isPaused.get()) {
                        Thread.sleep(100);
                        continue;
                    }
                    
                    String password = passwords.next();
                    currentPassword = password;
                    
                    // Test password against handshake
                    if (testPassword(password, captureFile)) {
                        foundPassword = password;
                        isRunning.set(false);
                        ProgressHandler.broadcast(Map.of(
                            "status", "found",
                            "password", password,
                            "tested", testedCount.get(),
                            "time", (System.currentTimeMillis() - startTime.get()) / 1000
                        ));
                        break;
                    }
                    
                    testedCount.incrementAndGet();
                    
                    // Broadcast progress every 100 attempts
                    if (testedCount.get() % 100 == 0) {
                        broadcastProgress();
                    }
                }
                
                if (foundPassword == null && isRunning.get()) {
                    ProgressHandler.broadcast(Map.of("status", "failed"));
                }
                
            } catch (Exception e) {
                e.printStackTrace();
                ProgressHandler.broadcast(Map.of("status", "error", "message", e.getMessage()));
            } finally {
                isRunning.set(false);
            }
        });
        
        attackThread.start();
    }
    
    private boolean testPassword(String password, String captureFile) {
        // Integration with aircrack-ng or hashcat
        // Returns true if password is correct
        return false; // Demo
    }
    
    private void broadcastProgress() {
        long elapsed = (System.currentTimeMillis() - startTime.get()) / 1000;
        long speed = elapsed > 0 ? testedCount.get() / elapsed : 0;
        
        ProgressHandler.broadcast(new AttackStatus(
            testedCount.get(),
            1000000, // estimated total
            speed,
            elapsed,
            currentPassword,
            isRunning.get() ? "running" : "stopped"
        ));
    }
    
    public AttackStatus getStatus() {
        long elapsed = (System.currentTimeMillis() - startTime.get()) / 1000;
        long speed = elapsed > 0 ? testedCount.get() / elapsed : 0;
        
        return new AttackStatus(
            testedCount.get(),
            1000000,
            speed,
            elapsed,
            currentPassword,
            isRunning.get() ? (isPaused.get() ? "paused" : "running") : "stopped"
        );
    }
    
    public void pause() {
        isPaused.set(true);
    }
    
    public void resume() {
        isPaused.set(false);
    }
    
    public void stop() {
        isRunning.set(false);
        if (attackThread != null) {
            attackThread.interrupt();
        }
    }
}

// Password Generator
@Component
class PasswordGenerator {
    
    public Iterator<String> generate(CrackRequest config) {
        List<String> passwords = new ArrayList<>();
        
        // Build character set
        StringBuilder chars = new StringBuilder();
        if (config.getCharsets().contains("lower")) chars.append("abcdefghijklmnopqrstuvwxyz");
        if (config.getCharsets().contains("upper")) chars.append("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
        if (config.getCharsets().contains("numbers")) chars.append("0123456789");
        if (config.getCharsets().contains("symbols")) chars.append("!@#$%^&*");
        
        // Generate based on mode
        switch (config.getAttackMode()) {
            case "dictionary":
                passwords.addAll(generateDictionaryWords(config));
                break;
            case "brute":
                passwords.addAll(generateBruteForce(config, chars.toString()));
                break;
            case "hybrid":
                passwords.addAll(generateHybrid(config, chars.toString()));
                break;
        }
        
        return passwords.iterator();
    }
    
    private List<String> generateDictionaryWords(CrackRequest config) {
        List<String> words = new ArrayList<>();
        
        // Common passwords
        words.addAll(Arrays.asList(
            "password", "123456", "qwerty", "admin", "welcome",
            "password123", "admin123", "letmein", "monkey", "dragon"
        ));
        
        // Add custom words
        if (config.getCustomWords() != null && !config.getCustomWords().isEmpty()) {
            words.addAll(Arrays.asList(config.getCustomWords().split("[,\\n]")));
        }
        
        // Apply mutations
        List<String> mutated = new ArrayList<>();
        for (String word : words) {
            mutated.add(word);
            
            if (config.getRules().isNumbers()) {
                for (int i = 0; i <= 999; i++) {
                    mutated.add(word + i);
                }
            }
            
            if (config.getRules().isSymbols()) {
                mutated.add(word + "!");
                mutated.add(word + "@");
                mutated.add(word + "#");
            }
            
            if (config.getRules().isLeet()) {
                mutated.add(word.replace('a', '4').replace('e', '3').replace('s', '$'));
            }
            
            if (config.getRules().isCase()) {
                mutated.add(word.toUpperCase());
            }
        }
        
        return mutated;
    }
    
    private List<String> generateBruteForce(CrackRequest config, String chars) {
        List<String> result = new ArrayList<>();
        int minLen = config.getMinLength();
        int maxLen = Math.min(config.getMaxLength(), 6); // Limit for demo
        
        generateCombinations(result, "", chars, minLen, maxLen);
        return result;
    }
    
    private void generateCombinations(List<String> result, String prefix, String chars, int minLen, int maxLen) {
        if (prefix.length() >= minLen) {
            result.add(prefix);
        }
        if (prefix.length() >= maxLen) {
            return;
        }
        
        for (int i = 0; i < chars.length(); i++) {
            generateCombinations(result, prefix + chars.charAt(i), chars, minLen, maxLen);
        }
    }
    
    private List<String> generateHybrid(CrackRequest config, String chars) {
        List<String> words = generateDictionaryWords(config);
        List<String> result = new ArrayList<>();
        
        for (String word : words) {
            // Add word + random chars
            for (int i = 0; i < 100; i++) {
                String suffix = generateRandomString(chars, 4);
                result.add(word + suffix);
            }
        }
        
        return result;
    }
    
    private String generateRandomString(String chars, int length) {
        StringBuilder sb = new StringBuilder();
        Random random = new Random();
        for (int i = 0; i < length; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }
}

// Data Classes
class NetworkInfo {
    private String ssid;
    private String bssid;
    private String security;
    private int signal;
    
    public NetworkInfo(String ssid, String bssid, String security, int signal) {
        this.ssid = ssid;
        this.bssid = bssid;
        this.security = security;
        this.signal = signal;
    }
    
    // Getters
    public String getSsid() { return ssid; }
    public String getBssid() { return bssid; }
    public String getSecurity() { return security; }
    public int getSignal() { return signal; }
}

class CrackRequest {
    private String attackMode;
    private List<String> charsets;
    private int minLength;
    private int maxLength;
    private Rules rules;
    private String customWords;
    
    // Getters and setters
    public String getAttackMode() { return attackMode; }
    public void setAttackMode(String attackMode) { this.attackMode = attackMode; }
    public List<String> getCharsets() { return charsets; }
    public void setCharsets(List<String> charsets) { this.charsets = charsets; }
    public int getMinLength() { return minLength; }
    public void setMinLength(int minLength) { this.minLength = minLength; }
    public int getMaxLength() { return maxLength; }
    public void setMaxLength(int maxLength) { this.maxLength = maxLength; }
    public Rules getRules() { return rules; }
    public void setRules(Rules rules) { this.rules = rules; }
    public String getCustomWords() { return customWords; }
    public void setCustomWords(String customWords) { this.customWords = customWords; }
}

class Rules {
    private boolean numbers;
    private boolean symbols;
    private boolean leet;
    private boolean caseVar;
    
    public boolean isNumbers() { return numbers; }
    public void setNumbers(boolean numbers) { this.numbers = numbers; }
    public boolean isSymbols() { return symbols; }
    public void setSymbols(boolean symbols) { this.symbols = symbols; }
    public boolean isLeet() { return leet; }
    public void setLeet(boolean leet) { this.leet = leet; }
    public boolean isCase() { return caseVar; }
    public void setCase(boolean caseVar) { this.caseVar = caseVar; }
}

class AttackStatus {
    private long tested;
    private long total;
    private long speed;
    private long elapsed;
    private String current;
    private String status;
    private String password;
    
    public AttackStatus(long tested, long total, long speed, long elapsed, String current, String status) {
        this.tested = tested;
        this.total = total;
        this.speed = speed;
        this.elapsed = elapsed;
        this.current = current;
        this.status = status;
    }
    
    // Getters
    public long getTested() { return tested; }
    public long getTotal() { return total; }
    public long getSpeed() { return speed; }
    public long getElapsed() { return elapsed; }
    public String getCurrent() { return current; }
    public String getStatus() { return status; }
    public String getPassword() { return password; }
}

// Session Storage
class SessionData {
    private static String currentFile;
    
    public static void setCurrentFile(String file) {
        currentFile = file;
    }
    
    public static String getCurrentFile() {
        return currentFile;
    }
}
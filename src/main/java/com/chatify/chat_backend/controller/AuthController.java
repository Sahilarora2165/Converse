package com.chatify.chat_backend.controller;

import com.chatify.chat_backend.dto.AuthResponseDTO;
import com.chatify.chat_backend.dto.UserLoginDTO;
import com.chatify.chat_backend.dto.UserRegistrationDTO;
import com.chatify.chat_backend.entity.User;
import com.chatify.chat_backend.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.chatify.chat_backend.security.JwtUtil;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import com.chatify.chat_backend.repository.UserRepository;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final JwtUtil jwtUtil; //
    private final UserRepository userRepository;

    public AuthController(AuthService authService, JwtUtil jwtUtil, UserRepository userRepository){ // ✅ Inject JwtUtil
        this.authService = authService;
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body("Not authenticated");
        }
        User user = userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(
                new AuthResponseDTO(null, null, user.getUsername(), user.getEmail(), user.getId())
        );
    }


    // Register a new user
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody UserRegistrationDTO registrationDTO){
        try{
            String result = authService.register(registrationDTO);
            return ResponseEntity.ok(result); // ✅ 200 OK + token
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage()); // ❌ 400 Bad Request
        }
    }

    // Login user with email and password
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody UserLoginDTO loginDTO){
        try {
            AuthResponseDTO response = authService.login(loginDTO);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            // SHOW THE ACTUAL ERROR - don't hide it
            return ResponseEntity.status(401).body(e.getMessage());
        }
    }

    // Refresh Token
    @PostMapping("/refresh")
    public ResponseEntity<AuthResponseDTO> refreshToken(@RequestBody Map<String, String> request){
        try {
            String refreshToken = request.get("refreshToken");
            AuthResponseDTO response = authService.refreshToken(refreshToken);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(401).build();
        }
    }

    // Logout
    @PostMapping("/logout")
    public ResponseEntity<?> logout(@RequestHeader("Authorization") String authHeader) {
        try {
            // 1. Check if Authorization header exists and is properly formatted
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                return ResponseEntity.ok("Logged out successfully");
            }

            // 2. Extract the token from "Bearer <token>"
            String token = authHeader.substring(7);

            // 3. Validate the token before processing
            if (!jwtUtil.validateToken(token)) {
                return ResponseEntity.ok("Logged out successfully");
            }

            // 4. Extract username from the VALIDATED token
            String email = jwtUtil.extractUsername(token);

            // 5. Call service to perform actual logout logic
            authService.logout(email);

            // 6. Return success response
            return ResponseEntity.ok("Logged out successfully");
        } catch (Exception e) {
            // 7. Always return success even if something fails
            return ResponseEntity.ok("Logged out successfully");
        }
    }
}

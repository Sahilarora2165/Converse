package com.chatify.chat_backend.controller;

import com.chatify.chat_backend.dto.AuthResponseDTO;
import com.chatify.chat_backend.dto.UserLoginDTO;
import com.chatify.chat_backend.dto.UserRegistrationDTO;
import com.chatify.chat_backend.service.AuthService;
import com.chatify.chat_backend.security.JwtUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.Base64;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final String OAUTH2_COOKIE_NAME = "oauth2_pending";

    private final AuthService authService;
    private final JwtUtil jwtUtil;
    private final ObjectMapper objectMapper;

    public AuthController(AuthService authService, JwtUtil jwtUtil, ObjectMapper objectMapper) {
        this.authService = authService;
        this.jwtUtil = jwtUtil;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody UserRegistrationDTO registrationDTO) {
        try {
            String result = authService.register(registrationDTO);
            return ResponseEntity.ok(Map.of("message", result));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody UserLoginDTO loginDTO) {
        try {
            AuthResponseDTO response = authService.login(loginDTO);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid email or password"));
        }
    }

    /**
     * OAuth2 Token Exchange Endpoint
     *
     * Called by OAuthCallback.jsx immediately after Google redirects back to the app.
     * Reads the short-lived HttpOnly cookie set by OAuth2SuccessHandler,
     * returns the auth tokens as JSON, then immediately deletes the cookie.
     *
     * Why this pattern:
     * - Tokens never appear in URLs (no fragment encoding issues, no nginx stripping)
     * - Cookie is HttpOnly (JS cannot steal it via XSS)
     * - Cookie is scoped to this path only
     * - Cookie is deleted after single use — cannot be replayed
     * - Cookie expires in 2 minutes regardless
     */
    @GetMapping("/oauth2/token")
    public ResponseEntity<?> exchangeOAuth2Token(HttpServletRequest request,
                                                 HttpServletResponse response) {
        try {
            // Find the pending OAuth2 cookie
            Cookie[] cookies = request.getCookies();
            if (cookies == null) {
                return ResponseEntity.status(401)
                        .body(Map.of("error", "No OAuth2 session found. Please try logging in again."));
            }

            Cookie pendingCookie = Arrays.stream(cookies)
                    .filter(c -> OAUTH2_COOKIE_NAME.equals(c.getName()))
                    .findFirst()
                    .orElse(null);

            if (pendingCookie == null) {
                return ResponseEntity.status(401)
                        .body(Map.of("error", "OAuth2 session expired or not found. Please try logging in again."));
            }

            // Decode and deserialize the auth response from the cookie
            byte[] decoded = Base64.getDecoder().decode(pendingCookie.getValue());
            AuthResponseDTO authResponse = objectMapper.readValue(decoded, AuthResponseDTO.class);

            // Immediately delete the cookie — single use, cannot be replayed
            Cookie deleteCookie = new Cookie(OAUTH2_COOKIE_NAME, "");
            deleteCookie.setHttpOnly(true);
            deleteCookie.setMaxAge(0); // Delete immediately
            deleteCookie.setPath("/api/auth/oauth2/token");
            response.addCookie(deleteCookie);

            // Return tokens as normal JSON — frontend stores them in localStorage
            return ResponseEntity.ok(authResponse);

        } catch (Exception e) {
            return ResponseEntity.status(401)
                    .body(Map.of("error", "Failed to exchange OAuth2 token. Please try logging in again."));
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(@RequestBody Map<String, String> request) {
        try {
            String refreshToken = request.get("refreshToken");
            if (refreshToken == null || refreshToken.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Refresh token is required"));
            }
            AuthResponseDTO response = authService.refreshToken(refreshToken);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid or expired refresh token"));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        try {
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
            }
            String token = authHeader.substring(7);
            if (!jwtUtil.validateToken(token)) {
                return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
            }
            String email = jwtUtil.extractUsername(token);
            authService.logout(email);
            return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
        }
    }
}
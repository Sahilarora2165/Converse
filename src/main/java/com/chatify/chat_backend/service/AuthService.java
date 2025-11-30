// Location: src/main/java/com/chatify/chat_backend/service/AuthService.java
package com.chatify.chat_backend.service;

import com.chatify.chat_backend.dto.UserLoginDTO;
import com.chatify.chat_backend.dto.UserRegistrationDTO;
import com.chatify.chat_backend.dto.AuthResponseDTO;
import com.chatify.chat_backend.entity.RefreshToken;
import com.chatify.chat_backend.entity.User;
import com.chatify.chat_backend.repository.RefreshTokenRepository;
import com.chatify.chat_backend.repository.UserRepository;
import com.chatify.chat_backend.security.JwtUtil;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authenticationManager;

    @Value("${app.jwt.refresh-token.expiration-ms}")
    private long refreshTokenExpirationMs;

    public AuthService(
            UserRepository userRepository,
            RefreshTokenRepository refreshTokenRepository,
            PasswordEncoder passwordEncoder,
            JwtUtil jwtUtil,
            AuthenticationManager authenticationManager) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.authenticationManager = authenticationManager;
    }

    @Transactional
    public String register(UserRegistrationDTO request) {
        if (userRepository.findByUsername(request.getUsername()).isPresent()) {
            throw new RuntimeException("Username already taken: " + request.getUsername());
        }
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new RuntimeException("Email already registered: " + request.getEmail());
        }
        User user = new User();
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        userRepository.save(user);
        return "User registered successfully";
    }

    public AuthResponseDTO login(UserLoginDTO request) {
        String email = request.getEmail();
        String password = request.getPassword();
        try {
            User user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("Invalid email or password"));
            authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(email, password));
            String accessToken = jwtUtil.generateToken(user.getEmail());
            String refreshToken = generateRefreshToken(user);
            return new AuthResponseDTO(accessToken, refreshToken, user.getUsername(),user.getEmail());
        } catch (AuthenticationException e) {
            throw new RuntimeException("Invalid email or password", e);
        }
    }

    private String generateRefreshToken(User user) {
        refreshTokenRepository.deleteAllByUser(user);
        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setUser(user);
        refreshToken.setToken(UUID.randomUUID().toString());
        refreshToken.setExpiryDate(Instant.now().plusMillis(refreshTokenExpirationMs));
        refreshTokenRepository.save(refreshToken);
        return refreshToken.getToken();
    }

    @Transactional
    public AuthResponseDTO refreshToken(String requestRefreshToken) {
        return refreshTokenRepository.findByToken(requestRefreshToken)
                .map(this::verifyExpiration)
                .map(refreshToken -> {
                    User user = refreshToken.getUser();
                    refreshTokenRepository.delete(refreshToken);
                    String accessToken = jwtUtil.generateToken(user.getEmail()); // Changed from user.getUsername()
                    String newRefreshToken = generateRefreshToken(user);
                    return new AuthResponseDTO(accessToken, newRefreshToken, user.getUsername(), user.getEmail());
                })
                .orElseThrow(() -> new RuntimeException("Refresh token not found"));
    }

    private RefreshToken verifyExpiration(RefreshToken token) {
        if (token.getExpiryDate().compareTo(Instant.now()) < 0) {
            refreshTokenRepository.delete(token);
            throw new RuntimeException("Refresh token expired");
        }
        return token;
    }

    @Transactional
    public void logout(String email) {
        userRepository.findByEmail(email).ifPresent(user -> {
            int deletedCount = refreshTokenRepository.deleteAllByUser(user);
            System.out.println("Deleted " + deletedCount + " refresh tokens for user: " + email);
        });
    }
}
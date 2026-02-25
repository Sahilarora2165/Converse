package com.chatify.chat_backend.service;

import com.chatify.chat_backend.dto.UserLoginDTO;
import com.chatify.chat_backend.dto.UserRegistrationDTO;
import com.chatify.chat_backend.dto.AuthResponseDTO;
import com.chatify.chat_backend.entity.RefreshToken;
import com.chatify.chat_backend.entity.User;
import com.chatify.chat_backend.repository.RefreshTokenRepository;
import com.chatify.chat_backend.repository.UserRepository;
import com.chatify.chat_backend.security.JwtUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    @Value("${app.jwt.refresh-token.expiration-ms}")
    private long refreshTokenExpirationMs;

    public AuthService(
            UserRepository userRepository,
            RefreshTokenRepository refreshTokenRepository,
            PasswordEncoder passwordEncoder,
            JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
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

    @Transactional
    public AuthResponseDTO login(UserLoginDTO request) {
        String email = request.getEmail();
        String password = request.getPassword();

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Invalid email or password"));

        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new RuntimeException("Invalid email or password");
        }

        String accessToken = jwtUtil.generateToken(user.getEmail());
        String refreshToken = generateRefreshToken(user);

        return new AuthResponseDTO(accessToken, refreshToken, user.getUsername(), user.getEmail(), user.getId());
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
                    String accessToken = jwtUtil.generateToken(user.getEmail());
                    String newRefreshToken = generateRefreshToken(user);
                    return new AuthResponseDTO(accessToken, newRefreshToken, user.getUsername(), user.getEmail(),
                            user.getId());
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
            log.info("Deleted {} refresh tokens for user: {}", deletedCount, email);
        });
    }

    @Transactional
    public String loginOrRegisterOAuthUser(String email, String name, String googleId, String picture) {
        User user = userRepository.findByEmail(email).orElseGet(() -> {
            User newUser = new User();
            newUser.setEmail(email);
            newUser.setUsername(generateUniqueUsername(name));
            newUser.setPassword(null);
            newUser.setProvider("google");
            newUser.setProviderId(googleId);
            newUser.setProfilePicture(picture);
            return userRepository.save(newUser);
        });

        // If user exists and signed up locally, link their Google account (one-time)
        if ("local".equals(user.getProvider())) {
            user.setProvider("google_linked");
            user.setProviderId(googleId);
            if (user.getProfilePicture() == null && picture != null) {
                user.setProfilePicture(picture);
            }
            userRepository.save(user);
        }

        return jwtUtil.generateToken(user.getEmail());
    }

    private String generateUniqueUsername(String name) {
        String base = name.toLowerCase().replaceAll("[^a-z0-9]", "");
        if (base.isEmpty()) base = "user";
        String username = base;
        int counter = 1;
        while (userRepository.findByUsername(username).isPresent()) {
            username = base + counter++;
        }
        return username;
    }
}
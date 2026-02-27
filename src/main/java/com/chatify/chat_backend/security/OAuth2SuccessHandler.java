package com.chatify.chat_backend.security;

import com.chatify.chat_backend.dto.AuthResponseDTO;
import com.chatify.chat_backend.service.AuthService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Base64;

@Component
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private static final Logger log = LoggerFactory.getLogger(OAuth2SuccessHandler.class);
    private static final String COOKIE_NAME = "oauth2_pending";
    private static final int COOKIE_MAX_AGE = 120; // 2 minutes

    private final AuthService authService;
    private final ObjectMapper objectMapper;

    @Value("${app.oauth2.redirect-uri}")
    private String redirectUri;

    public OAuth2SuccessHandler(AuthService authService, ObjectMapper objectMapper) {
        this.authService = authService;
        this.objectMapper = objectMapper;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException {

        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();

        String email    = oAuth2User.getAttribute("email");
        String name     = oAuth2User.getAttribute("name");
        String googleId = oAuth2User.getAttribute("sub");
        String picture  = oAuth2User.getAttribute("picture");

        if (email == null) {
            log.error("OAuth2 login failed: email attribute missing from Google response");
            response.sendRedirect(redirectUri + "?error=oauth2_email_missing");
            return;
        }

        try {
            AuthResponseDTO authResponse = authService.loginOrRegisterOAuthUser(email, name, googleId, picture);

            String json        = objectMapper.writeValueAsString(authResponse);
            String cookieValue = Base64.getEncoder().encodeToString(json.getBytes());


            Cookie existingCookie = new Cookie(COOKIE_NAME, null);
            existingCookie.setPath("/");
            existingCookie.setMaxAge(0);
            response.addCookie(existingCookie);


            Cookie cookie = new Cookie(COOKIE_NAME, cookieValue);
            cookie.setHttpOnly(true);
            cookie.setMaxAge(COOKIE_MAX_AGE);
            cookie.setPath("/");
            cookie.setAttribute("SameSite", "Lax");
            cookie.setSecure(false);

            response.addCookie(cookie);

            log.info("OAuth2 success for: {} — pending cookie set, redirecting to callback", email);


            response.sendRedirect(redirectUri + "?t=" + System.currentTimeMillis());

        } catch (Exception e) {
            log.error("OAuth2 processing failed for email: {}", email, e);
            response.sendRedirect(redirectUri + "?error=oauth2_processing_failed");
        }
    }
}
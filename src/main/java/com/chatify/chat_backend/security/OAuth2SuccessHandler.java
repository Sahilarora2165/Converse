package com.chatify.chat_backend.security;

import com.chatify.chat_backend.entity.User;
import com.chatify.chat_backend.repository.UserRepository;
import com.chatify.chat_backend.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Component
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final AuthService authService;
    private final UserRepository userRepository;

    @Value("${app.oauth2.redirect-uri}")
    private String redirectUri;

    public OAuth2SuccessHandler(AuthService authService, UserRepository userRepository) {
        this.authService = authService;
        this.userRepository = userRepository;
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

        String token = authService.loginOrRegisterOAuthUser(email, name, googleId, picture);

        // Fetch saved user to get id and username
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found after OAuth"));

        String redirectUrl = redirectUri
                + "?token=" + token
                + "&id=" + user.getId()
                + "&username=" + URLEncoder.encode(user.getUsername(), StandardCharsets.UTF_8)
                + "&email=" + URLEncoder.encode(user.getEmail(), StandardCharsets.UTF_8);

        getRedirectStrategy().sendRedirect(request, response, redirectUrl);
    }
}
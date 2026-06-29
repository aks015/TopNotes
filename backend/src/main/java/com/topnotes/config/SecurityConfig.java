package com.topnotes.config;

import com.topnotes.security.JwtAuthFilter;
import com.topnotes.security.UserDetailsServiceImpl;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Spring Security configuration — stateless JWT, role-based access control.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
public class SecurityConfig {

    private final JwtAuthFilter           jwtAuthFilter;
    private final UserDetailsServiceImpl  userDetailsService;

    @Value("${app.cors.allowed-origins}")
    private String allowedOrigins;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter,
                          UserDetailsServiceImpl userDetailsService) {
        this.jwtAuthFilter      = jwtAuthFilter;
        this.userDetailsService = userDetailsService;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // Disable CSRF — using stateless JWT
            .csrf(AbstractHttpConfigurer::disable)

            // Let Spring Security use the shared CorsConfigurationSource bean.
            .cors(Customizer.withDefaults())

            // Session management — stateless
            .sessionManagement(sm ->
                sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

            // Request authorization
            .authorizeHttpRequests(auth -> auth

                // ── Public endpoints ───────────────────────
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                // Email verification is tied to the signed-in user — must come
                // BEFORE the broad /auth/** permitAll so it stays authenticated.
                .requestMatchers("/auth/email/**").authenticated()
                .requestMatchers("/auth/**").permitAll()
                .requestMatchers("/health").permitAll()
                // Payment gateway webhooks are authenticated by signature, not JWT
                .requestMatchers("/payments/webhook/**").permitAll()
                // Public landing-page content (admin edits via /admin/content/**)
                .requestMatchers(HttpMethod.GET, "/content/**").permitAll()
                // Public exam taxonomy (admin edits via /admin/taxonomy/**)
                .requestMatchers(HttpMethod.GET, "/taxonomy").permitAll()
                // Public social-proof stats for the landing page
                .requestMatchers(HttpMethod.GET, "/stats/social").permitAll()
                .requestMatchers(HttpMethod.GET,
                        "/notes",
                        "/notes/{id}",
                        "/notes/{id}/preview",
                        "/notes/filters",
                        "/notes/price-suggestion",
                        "/notes/{id}/reviews",
                        "/notes/{id}/reviews/stats").permitAll()
                // Public seller profiles (the "/u/{id}" page)
                .requestMatchers(HttpMethod.GET, "/sellers/{id}", "/sellers/{id}/notes").permitAll()
                // Swagger UI
                .requestMatchers(
                        "/swagger-ui/**",
                        "/swagger-ui.html",
                        "/v3/api-docs/**").permitAll()
                // Actuator health check
                .requestMatchers("/actuator/health").permitAll()

                // ── Role-based endpoints ───────────────────
                .requestMatchers("/admin/**").hasRole("ADMIN")
                .requestMatchers("/seller/**").hasRole("SELLER")
                // Buying is open to any non-admin user (a seller can buy too)
                .requestMatchers("/buyer/**").hasAnyRole("BUYER", "SELLER")

                // ── Authenticated endpoints ────────────────
                .requestMatchers("/notifications/**").authenticated()
                .requestMatchers("/profile/**").authenticated()

                // ── Note mutations require SELLER ──────────
                .requestMatchers(HttpMethod.POST,   "/notes").hasRole("SELLER")
                .requestMatchers(HttpMethod.POST,   "/notes/**").hasRole("SELLER")
                .requestMatchers(HttpMethod.PUT,    "/notes/**").hasRole("SELLER")
                .requestMatchers(HttpMethod.PATCH,  "/notes/**").hasRole("SELLER")
                .requestMatchers(HttpMethod.DELETE, "/notes/**").hasRole("SELLER")

                // ── Note full view requires a purchase (any non-admin) ──
                .requestMatchers(HttpMethod.GET, "/notes/{id}/view").hasAnyRole("BUYER", "SELLER")

                // Deny everything else unless authenticated
                .anyRequest().authenticated()
            )

            // Distinguish "not authenticated" (401) from "authenticated but
            // forbidden" (403). Without this Spring's default returns 403 for
            // BOTH, so the SPA can't tell an expired/invalid token from a real
            // permission denial and never clears the stale session.
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((req, res, e) ->
                        writeError(res, HttpServletResponse.SC_UNAUTHORIZED,
                                "Authentication required — please log in again."))
                .accessDeniedHandler((req, res, e) ->
                        writeError(res, HttpServletResponse.SC_FORBIDDEN,
                                "You don't have permission to do that."))
            )

            // Inject JWT filter before username/password filter
            .authenticationProvider(authenticationProvider())
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /** Writes a minimal ApiResponse-shaped JSON error body with the given status. */
    private static void writeError(HttpServletResponse res, int status, String message)
            throws java.io.IOException {
        res.setStatus(status);
        res.setContentType("application/json");
        res.setCharacterEncoding("UTF-8");
        res.getWriter().write("{\"success\":false,\"message\":\"" + message + "\"}");
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}

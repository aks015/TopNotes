package com.topnotes.controller;

import com.topnotes.dto.request.LoginRequest;
import com.topnotes.dto.request.RegisterRequest;
import com.topnotes.dto.response.ApiResponse;
import com.topnotes.dto.response.AuthResponse;
import com.topnotes.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Handles user registration and login.
 * These endpoints are publicly accessible — no JWT required.
 */
@RestController
@RequestMapping("/auth")
@Tag(name = "Authentication", description = "Register and login endpoints")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    @Operation(summary = "Register a new BUYER or SELLER account")
    public ResponseEntity<ApiResponse<AuthResponse>> register(
            @Valid @RequestBody RegisterRequest request) {

        AuthResponse response = authService.register(request);
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success("Account registered successfully", response));
    }

    @PostMapping("/login")
    @Operation(summary = "Login with email and password — returns JWT token")
    public ResponseEntity<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody LoginRequest request) {

        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(ApiResponse.success("Login successful", response));
    }

    @PostMapping("/refresh")
    @Operation(summary = "Exchange a valid refresh token for a fresh access token")
    public ResponseEntity<ApiResponse<AuthResponse>> refresh(
            @RequestBody java.util.Map<String, String> body) {

        AuthResponse response = authService.refreshAccessToken(body.get("refreshToken"));
        return ResponseEntity.ok(ApiResponse.success("Token refreshed", response));
    }
}

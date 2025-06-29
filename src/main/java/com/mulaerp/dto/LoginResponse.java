package com.mulaerp.dto;

public class LoginResponse {
    private String token;
    private UserInfo user;
    private String error;

    public LoginResponse() {}

    public LoginResponse(String token, UserInfo user, String error) {
        this.token = token;
        this.user = user;
        this.error = error;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public UserInfo getUser() {
        return user;
    }

    public void setUser(UserInfo user) {
        this.user = user;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }
}
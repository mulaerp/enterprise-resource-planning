package com.mulaerp.dto;

public class CasPreloginRequest {
    private String username;

    public CasPreloginRequest() {}

    public CasPreloginRequest(String username) {
        this.username = username;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }
}
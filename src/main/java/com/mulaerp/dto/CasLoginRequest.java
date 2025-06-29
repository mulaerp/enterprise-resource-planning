package com.mulaerp.dto;

public class CasLoginRequest {
    private String username;
    private String password;
    private String imageId;

    public CasLoginRequest() {}

    public CasLoginRequest(String username, String password, String imageId) {
        this.username = username;
        this.password = password;
        this.imageId = imageId;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getImageId() {
        return imageId;
    }

    public void setImageId(String imageId) {
        this.imageId = imageId;
    }
}
package com.mulaerp.dto;

public class CasPasswordVerifyRequest {
    private String username;
    private String encryptedPassword;
    private String keyId;
    private String imageId;

    public CasPasswordVerifyRequest() {}

    public CasPasswordVerifyRequest(String username, String encryptedPassword, String keyId, String imageId) {
        this.username = username;
        this.encryptedPassword = encryptedPassword;
        this.keyId = keyId;
        this.imageId = imageId;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getEncryptedPassword() {
        return encryptedPassword;
    }

    public void setEncryptedPassword(String encryptedPassword) {
        this.encryptedPassword = encryptedPassword;
    }

    public String getKeyId() {
        return keyId;
    }

    public void setKeyId(String keyId) {
        this.keyId = keyId;
    }

    public String getImageId() {
        return imageId;
    }

    public void setImageId(String imageId) {
        this.imageId = imageId;
    }
}
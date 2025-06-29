package com.mulaerp.dto;

public class CasPreloginDataPayload {
    private String passphrase;
    private String securityImage;

    public CasPreloginDataPayload() {}

    public String getPassphrase() {
        return passphrase;
    }

    public void setPassphrase(String passphrase) {
        this.passphrase = passphrase;
    }

    public String getSecurityImage() {
        return securityImage;
    }

    public void setSecurityImage(String securityImage) {
        this.securityImage = securityImage;
    }
}
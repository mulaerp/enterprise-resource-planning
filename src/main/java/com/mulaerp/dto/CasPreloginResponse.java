package com.mulaerp.dto;

import java.util.List;

public class CasPreloginResponse {
    private String phrase;
    private List<CasPreloginImage> images;

    public CasPreloginResponse() {}

    public CasPreloginResponse(String phrase, List<CasPreloginImage> images) {
        this.phrase = phrase;
        this.images = images;
    }

    public String getPhrase() {
        return phrase;
    }

    public void setPhrase(String phrase) {
        this.phrase = phrase;
    }

    public List<CasPreloginImage> getImages() {
        return images;
    }

    public void setImages(List<CasPreloginImage> images) {
        this.images = images;
    }
}
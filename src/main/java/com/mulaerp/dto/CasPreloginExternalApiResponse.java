package com.mulaerp.dto;

public class CasPreloginExternalApiResponse {
    private String responseCode;
    private String responseMsg;
    private CasPreloginDataPayload data;

    public CasPreloginExternalApiResponse() {}

    public String getResponseCode() {
        return responseCode;
    }

    public void setResponseCode(String responseCode) {
        this.responseCode = responseCode;
    }

    public String getResponseMsg() {
        return responseMsg;
    }

    public void setResponseMsg(String responseMsg) {
        this.responseMsg = responseMsg;
    }

    public CasPreloginDataPayload getData() {
        return data;
    }

    public void setData(CasPreloginDataPayload data) {
        this.data = data;
    }
}
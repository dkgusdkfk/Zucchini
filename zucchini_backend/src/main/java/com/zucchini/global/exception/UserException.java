package com.zucchini.global.exception;

public class UserException extends RuntimeException {

    public UserException() {}
    public UserException(String msg) {
        super(msg);
    }

}

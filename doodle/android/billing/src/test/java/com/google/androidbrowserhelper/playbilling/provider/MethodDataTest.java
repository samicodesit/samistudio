// Copyright 2020 Google Inc. All Rights Reserved.
// Licensed under the Apache License, Version 2.0.
package com.google.androidbrowserhelper.playbilling.provider;

import android.os.Build;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.internal.DoNotInstrument;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

@RunWith(RobolectricTestRunner.class)
@DoNotInstrument
@Config(sdk = {Build.VERSION_CODES.O_MR1})
public class MethodDataTest {
    private static final String ACCOUNT_ID =
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    @Test
    public void fromJson_requiresValidBackendAccountId() {
        MethodData data = MethodData.fromJson(json(ACCOUNT_ID));
        assertEquals("doodle_credits_10", data.sku);
        assertEquals(ACCOUNT_ID, data.obfuscatedAccountId);
        assertNull(MethodData.fromJson("{\"sku\":\"doodle_credits_10\"}"));
        assertNull(MethodData.fromJson(json(ACCOUNT_ID.substring(1))));
        assertNull(MethodData.fromJson(json(ACCOUNT_ID.toUpperCase())));
        assertNull(MethodData.fromJson(json(ACCOUNT_ID.substring(0, 63) + "g")));
    }

    private static String json(String accountId) {
        return "{\"sku\":\"doodle_credits_10\",\"obfuscatedAccountId\":\""
                + accountId + "\"}";
    }
}

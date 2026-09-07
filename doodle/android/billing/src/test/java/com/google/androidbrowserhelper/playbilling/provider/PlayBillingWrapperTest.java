// Copyright 2020 Google Inc. All Rights Reserved.
// Licensed under the Apache License, Version 2.0.
package com.google.androidbrowserhelper.playbilling.provider;

import android.os.Build;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.ProductDetails;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.internal.DoNotInstrument;
import java.lang.reflect.Field;
import java.util.Arrays;
import static org.junit.Assert.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@RunWith(RobolectricTestRunner.class)
@DoNotInstrument
@Config(sdk = {Build.VERSION_CODES.O_MR1})
public class PlayBillingWrapperTest {
    private static final String ACCOUNT_ID =
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    @Test
    public void paymentFlowParamsCarryBackendAccountId() throws IllegalAccessException {
        ProductDetails productDetails = mock(ProductDetails.class);
        when(productDetails.getProductType()).thenReturn(BillingClient.ProductType.INAPP);
        when(productDetails.zza()).thenReturn("doodle_credits_10");
        MethodData methodData = MethodData.fromJson(
                "{\"sku\":\"doodle_credits_10\",\"obfuscatedAccountId\":\""
                        + ACCOUNT_ID + "\"}");

        BillingFlowParams params =
                PlayBillingWrapper.createBillingFlowParams(productDetails, methodData);

        boolean accountIdPresent = false;
        for (Field field : Arrays.stream(BillingFlowParams.class.getDeclaredFields())
                .filter(value -> value.getType().equals(String.class)).toArray(Field[]::new)) {
            field.setAccessible(true);
            accountIdPresent |= ACCOUNT_ID.equals(field.get(params));
        }
        assertTrue(accountIdPresent);
    }
}

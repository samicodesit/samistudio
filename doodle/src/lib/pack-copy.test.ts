import {expect,it} from "vitest";
import {fillPackText,getPackCopy} from "./pack-copy";
it.each([[6,"رسومات"],[10,"رسومات"],[20,"رسمة"],[25,"رسمة"],[60,"رسمة"]] as const)("uses the Arabic count form for %i credits in pack labels and confirmation",(count,noun)=>{
  const copy=getPackCopy("ar",count);
  expect(fillPackText(copy.quantity,{count})).toBe(`${count} ${noun}`);
  expect(fillPackText(copy.buy,{count,price:"EGP 129.99"})).toBe(`احصل على ${count} ${noun} · EGP 129.99`);
  expect(fillPackText(copy.added,{count})).toBe(`تمت إضافة ${count} ${noun}`);
});
it.each([["ja","\u304a\u652f\u6255\u3044\u3092\u51e6\u7406\u4e2d"],["ko","\uacb0\uc81c \ucc98\ub9ac \uc911"],["ar","\u062c\u0627\u0631\u064d \u0645\u0639\u0627\u0644\u062c\u0629 \u0627\u0644\u062f\u0641\u0639"]] as const)("renders the %s payment status in its language",(locale,label)=>{expect(getPackCopy(locale).processing).toBe(label);});

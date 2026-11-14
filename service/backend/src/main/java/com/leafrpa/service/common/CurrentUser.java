package com.leafrpa.service.common;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** 标注在 User 类型参数上，自动从 Authorization 头解析并注入当前登录用户。 */
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
public @interface CurrentUser {

    /** true 表示必须登录，未登录直接抛 401。 */
    boolean required() default true;
}

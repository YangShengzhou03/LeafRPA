package com.leafrpa.service.common;

import java.util.List;

/** 通用分页结果：items 为当前页数据，total 为过滤后的总条数，page 从 0 开始。 */
public record PageResult<T>(List<T> items, long total, int page, int size) {

    public static <T> PageResult<T> of(List<T> items, long total, int page, int size) {
        return new PageResult<>(items, total, page, size);
    }
}

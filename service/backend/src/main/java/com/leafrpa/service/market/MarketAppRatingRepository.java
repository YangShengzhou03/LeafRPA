package com.leafrpa.service.market;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MarketAppRatingRepository extends JpaRepository<MarketAppRating, Long> {

    MarketAppRating findByUserIdAndAppId(Long userId, Long appId);

    /** 聚合单行：[平均分（无评分时 coalesce 兜底 0），评分人数] */
    @Query("select coalesce(avg(r.stars), 0), count(r) from MarketAppRating r where r.appId = :appId")
    List<Object[]> summarizeByAppId(@Param("appId") Long appId);
}

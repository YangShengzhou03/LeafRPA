package com.leafrpa.service.market;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MarketAppRepository extends JpaRepository<MarketApp, Long> {

    @Query("""
            select a from MarketApp a
            where (:category = '' or a.category = :category)
              and (:keyword = '' or lower(a.name) like lower(concat('%', :keyword, '%'))
                   or lower(a.description) like lower(concat('%', :keyword, '%')))
            order by a.installs desc, a.name asc
            """)
    Page<MarketApp> search(@Param("category") String category, @Param("keyword") String keyword, Pageable pageable);

    /** 原子安装计数 +1：并发安装不丢计数 */
    @Modifying
    @Query("update MarketApp a set a.installs = a.installs + 1 where a.id = :id")
    void incrementInstalls(@Param("id") Long id);

    /** 原子安装计数 -1：下限 0（卸载时使用） */
    @Modifying
    @Query(value = "update market_apps set installs = installs - 1 where id = :id and installs > 0", nativeQuery = true)
    void decrementInstalls(@Param("id") Long id);

    /** 读取最新安装计数（原生查询绕过一级缓存，配合原子更新返回准确值） */
    @Query(value = "select installs from market_apps where id = :id", nativeQuery = true)
    long installsOf(@Param("id") Long id);
}

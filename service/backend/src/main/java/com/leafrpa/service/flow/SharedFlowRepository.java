package com.leafrpa.service.flow;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SharedFlowRepository extends JpaRepository<SharedFlow, Long> {

    @Query("""
            select f from SharedFlow f
            where (:keyword = '' or lower(f.name) like lower(concat('%', :keyword, '%'))
                   or lower(f.description) like lower(concat('%', :keyword, '%')))
            order by f.createdAt desc
            """)
    List<SharedFlow> findLatest(@Param("keyword") String keyword);

    @Query("""
            select f from SharedFlow f
            where (:keyword = '' or lower(f.name) like lower(concat('%', :keyword, '%'))
                   or lower(f.description) like lower(concat('%', :keyword, '%')))
            order by f.downloads desc, f.createdAt desc
            """)
    List<SharedFlow> findHot(@Param("keyword") String keyword);

    long countByAuthor(String author);

    /** 原子下载计数 +1：并发下载不丢计数 */
    @Modifying
    @Query("update SharedFlow f set f.downloads = f.downloads + 1 where f.id = :id")
    void incrementDownloads(@Param("id") Long id);
}

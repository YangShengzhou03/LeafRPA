package com.leafrpa.service.community;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PostRepository extends JpaRepository<Post, Long> {

    @Query("""
            select p from Post p
            where (:category = '' or p.category = :category)
              and (:keyword = '' or lower(p.title) like lower(concat('%', :keyword, '%'))
                   or lower(p.content) like lower(concat('%', :keyword, '%')))
            order by p.createdAt desc
            """)
    Page<Post> findLatest(@Param("category") String category, @Param("keyword") String keyword, Pageable pageable);

    @Query("""
            select p from Post p
            where (:category = '' or p.category = :category)
              and (:keyword = '' or lower(p.title) like lower(concat('%', :keyword, '%'))
                   or lower(p.content) like lower(concat('%', :keyword, '%')))
            order by p.likes desc, p.createdAt desc
            """)
    Page<Post> findHot(@Param("category") String category, @Param("keyword") String keyword, Pageable pageable);

    long countByAuthor(String author);

    /** 原子点赞 +1：并发点赞不丢计数（数据库行锁保证） */
    @Modifying
    @Query("update Post p set p.likes = p.likes + 1 where p.id = :id")
    void incrementLikes(@Param("id") Long id);

    /** 原子点赞 -1：下限 0（取消点赞时使用） */
    @Modifying
    @Query(value = "update posts set likes = likes - 1 where id = :id and likes > 0", nativeQuery = true)
    void decrementLikes(@Param("id") Long id);

    /** 读取最新点赞数（原生查询绕过一级缓存，配合原子更新返回准确值） */
    @Query(value = "select likes from posts where id = :id", nativeQuery = true)
    long likesOf(@Param("id") Long id);
}

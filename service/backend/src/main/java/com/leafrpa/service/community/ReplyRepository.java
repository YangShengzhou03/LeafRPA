package com.leafrpa.service.community;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ReplyRepository extends JpaRepository<Reply, Long> {

    long countByAuthor(String author);
}

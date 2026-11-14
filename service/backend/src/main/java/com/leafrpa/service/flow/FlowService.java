package com.leafrpa.service.flow;

import com.leafrpa.service.common.ApiException;
import com.leafrpa.service.user.User;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.UUID;

@Service
public class FlowService {

    private final SharedFlowRepository repository;
    private final Path storeDir;

    public FlowService(SharedFlowRepository repository,
                       @Value("${leaf.flow-store.dir}") String storeDir) {
        this.repository = repository;
        this.storeDir = Path.of(storeDir);
    }

    @PostConstruct
    void init() throws IOException {
        Files.createDirectories(storeDir);
    }

    public List<SharedFlow> list(boolean hot, String keyword) {
        String kw = keyword == null ? "" : keyword.trim();
        return hot ? repository.findHot(kw) : repository.findLatest(kw);
    }

    public SharedFlow detail(long id) {
        return repository.findById(id).orElseThrow(() -> ApiException.notFound("流程不存在"));
    }

    /** 上传 .leafrpa 流程文件。仅接受该扩展名，落盘文件名为随机 UUID，防止路径注入。 */
    @Transactional
    public SharedFlow upload(User author, String name, String description, int nodeCount, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("请选择要上传的 .leafrpa 文件");
        }
        if (name == null || name.trim().isEmpty()) {
            throw ApiException.badRequest("请填写流程名称");
        }
        if (name.trim().length() > 64) {
            throw ApiException.badRequest("流程名称不能超过 64 字");
        }
        if (description != null && description.trim().length() > 255) {
            throw ApiException.badRequest("流程简介不能超过 255 字");
        }
        String original = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        if (!original.toLowerCase().endsWith(".leafrpa")) {
            throw ApiException.badRequest("仅支持 .leafrpa 流程文件");
        }
        String stored = UUID.randomUUID() + ".leafrpa";
        try {
            file.transferTo(storeDir.resolve(stored).toAbsolutePath());
        } catch (IOException e) {
            throw new ApiException(500, "文件保存失败：" + e.getMessage());
        }
        SharedFlow flow = new SharedFlow();
        flow.setAuthor(author.getUsername());
        flow.setName(name.trim());
        flow.setDescription(description == null ? "" : description.trim());
        flow.setNodeCount(Math.max(0, nodeCount));
        flow.setFileName(stored);
        return repository.save(flow);
    }

    /** 下载：返回文件字节并累加下载计数（原子自增，并发不丢计数）。 */
    @Transactional
    public DownloadedFile download(long id) {
        SharedFlow flow = detail(id);
        Path path = storeDir.resolve(flow.getFileName()).toAbsolutePath();
        if (!Files.exists(path)) {
            throw ApiException.notFound("流程文件已丢失");
        }
        repository.incrementDownloads(id);
        byte[] bytes;
        try {
            bytes = Files.readAllBytes(path);
        } catch (IOException e) {
            throw new ApiException(500, "文件读取失败：" + e.getMessage());
        }
        String downloadName = flow.getName() + ".leafrpa";
        return new DownloadedFile(downloadName, bytes);
    }

    /** 删除：仅作者本人可删，同时清理磁盘文件。 */
    @Transactional
    public void delete(User user, long id) {
        SharedFlow flow = detail(id);
        if (!flow.getAuthor().equals(user.getUsername())) {
            throw ApiException.unauthorized("只有作者本人可以删除该流程");
        }
        repository.delete(flow);
        try {
            Files.deleteIfExists(storeDir.resolve(flow.getFileName()).toAbsolutePath());
        } catch (IOException e) {
            // 数据库记录已删，文件残留不影响业务
        }
    }

    public record DownloadedFile(String fileName, byte[] content) {
    }
}

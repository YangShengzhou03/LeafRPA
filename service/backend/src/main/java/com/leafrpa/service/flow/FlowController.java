package com.leafrpa.service.flow;

import com.leafrpa.service.common.ApiResponse;
import com.leafrpa.service.common.CurrentUser;
import com.leafrpa.service.user.User;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api/flows")
public class FlowController {

    private final FlowService flowService;

    public FlowController(FlowService flowService) {
        this.flowService = flowService;
    }

    /** 流程列表：sort=latest / hot，keyword 模糊匹配名称与描述。 */
    @GetMapping
    public ApiResponse<List<SharedFlow>> list(@RequestParam(defaultValue = "latest") String sort,
                                              @RequestParam(defaultValue = "") String keyword) {
        return ApiResponse.ok(flowService.list("hot".equals(sort), keyword));
    }

    @GetMapping("/{id}")
    public ApiResponse<SharedFlow> detail(@PathVariable long id) {
        return ApiResponse.ok(flowService.detail(id));
    }

    /** 上传 .leafrpa 流程文件（multipart/form-data）。 */
    @PostMapping
    public ApiResponse<SharedFlow> upload(@CurrentUser User user,
                                          @RequestParam("name") @Size(max = 120) String name,
                                          @RequestParam(value = "description", required = false) @Size(max = 255) String description,
                                          @RequestParam(value = "nodeCount", defaultValue = "0") int nodeCount,
                                          @RequestPart("file") MultipartFile file) {
        return ApiResponse.ok(flowService.upload(user, name, description, nodeCount, file));
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<byte[]> download(@PathVariable long id) {
        FlowService.DownloadedFile file = flowService.download(id);
        String encoded = URLEncoder.encode(file.fileName(), StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encoded)
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(file.content());
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@CurrentUser User user, @PathVariable long id) {
        flowService.delete(user, id);
        return ApiResponse.ok();
    }
}

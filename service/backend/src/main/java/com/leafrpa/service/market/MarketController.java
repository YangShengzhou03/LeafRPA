package com.leafrpa.service.market;

import com.leafrpa.service.common.ApiResponse;
import com.leafrpa.service.common.CurrentUser;
import com.leafrpa.service.common.PageResult;
import com.leafrpa.service.user.User;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/market")
public class MarketController {

    private final MarketService marketService;

    public MarketController(MarketService marketService) {
        this.marketService = marketService;
    }

    /** 应用分页列表；category 传「全部」或空表示全部分类，keyword 模糊匹配名称与描述；page 从 0 开始，size 默认 20。 */
    @GetMapping("/apps")
    public ApiResponse<PageResult<MarketApp>> list(@RequestParam(defaultValue = "") String category,
                                                   @RequestParam(defaultValue = "") String keyword,
                                                   @RequestParam(defaultValue = "0") int page,
                                                   @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(marketService.list(category, keyword, page, size));
    }

    @GetMapping("/apps/{id}")
    public ApiResponse<MarketApp> detail(@PathVariable long id) {
        return ApiResponse.ok(marketService.detail(id));
    }

    /** 安装（需登录）：同一用户重复安装只计一次。 */
    @PostMapping("/apps/{id}/install")
    public ApiResponse<MarketService.InstallResult> install(@CurrentUser User user, @PathVariable long id) {
        return ApiResponse.ok(marketService.install(user, id));
    }

    /** 卸载（需登录）：移除该用户的安装记录并递减计数。 */
    @PostMapping("/apps/{id}/uninstall")
    public ApiResponse<MarketService.UninstallResult> uninstall(@CurrentUser User user, @PathVariable long id) {
        return ApiResponse.ok(marketService.uninstall(user, id));
    }
}

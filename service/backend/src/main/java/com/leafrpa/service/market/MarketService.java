package com.leafrpa.service.market;

import com.leafrpa.service.common.ApiException;
import com.leafrpa.service.common.PageResult;
import com.leafrpa.service.user.User;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MarketService {

    /** 列表接口单页大小上限，防止恶意拉全量 */
    private static final int MAX_PAGE_SIZE = 50;

    private final MarketAppRepository repository;
    private final MarketInstallRepository installRepository;

    public MarketService(MarketAppRepository repository, MarketInstallRepository installRepository) {
        this.repository = repository;
        this.installRepository = installRepository;
    }

    /** 应用分页列表：page 从 0 开始，size 默认 20（上限 50）。 */
    public PageResult<MarketApp> list(String category, String keyword, int page, int size) {
        String cat = category == null ? "" : category.trim();
        String kw = keyword == null ? "" : keyword.trim();
        if ("全部".equals(cat)) {
            cat = "";
        }
        int p = Math.max(0, page);
        int s = Math.min(MAX_PAGE_SIZE, Math.max(1, size));
        var result = repository.search(cat, kw, PageRequest.of(p, s));
        return PageResult.of(result.getContent(), result.getTotalElements(), p, s);
    }

    public MarketApp detail(long id) {
        return repository.findById(id)
                .orElseThrow(() -> ApiException.notFound("应用不存在"));
    }

    /** 安装：同一用户重复安装只计一次（返回 false 表示已被该用户安装过）。 */
    @Transactional
    public InstallResult install(User user, long id) {
        MarketApp app = detail(id);
        if (installRepository.existsByUserIdAndAppId(user.getId(), id)) {
            return new InstallResult(app.getInstalls(), true);
        }
        MarketInstall record = new MarketInstall();
        record.setUserId(user.getId());
        record.setAppId(id);
        installRepository.save(record);
        repository.incrementInstalls(id);
        return new InstallResult(repository.installsOf(id), false);
    }

    /** 卸载：移除该用户的安装记录，计数 -1 最低到 0。 */
    @Transactional
    public UninstallResult uninstall(User user, long id) {
        detail(id);
        MarketInstall record = installRepository.findByUserIdAndAppId(user.getId(), id);
        boolean removed = false;
        if (record != null) {
            installRepository.delete(record);
            repository.decrementInstalls(id);
            removed = true;
        }
        return new UninstallResult(repository.installsOf(id), removed);
    }

    public record InstallResult(long installs, boolean alreadyInstalled) {
    }

    public record UninstallResult(long installs, boolean removed) {
    }
}

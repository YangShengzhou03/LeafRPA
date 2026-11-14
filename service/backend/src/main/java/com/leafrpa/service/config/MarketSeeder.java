package com.leafrpa.service.config;

import com.leafrpa.service.market.MarketApp;
import com.leafrpa.service.market.MarketAppRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/** 首次启动时为市场写入初始应用目录（与前端 marketApps.ts 保持一致）。 */
@Configuration
public class MarketSeeder {

    private static final Logger log = LoggerFactory.getLogger(MarketSeeder.class);

    @Bean
    CommandLineRunner seedMarketApps(MarketAppRepository repository) {
        return args -> {
            if (repository.count() > 0) {
                return;
            }
            List<MarketApp> apps = List.of(
                    app("网页数据抓取", "批量采集网页表格、列表与详情页数据", "数据采集", 126000, "#3b6fe0"),
                    app("Excel 批量处理", "多表合并、清洗、汇总与格式转换", "办公自动化", 98000, "#22c55e"),
                    app("电商订单同步", "订单自动下载、发货与库存回写", "电商运营", 72000, "#f97154"),
                    app("发票识别录入", "OCR 识别发票信息并自动写入财务系统", "财务税务", 54000, "#a05ff7"),
                    app("企业微信消息推送", "定时向群聊或客户发送通知与报表", "办公自动化", 49000, "#0ea5e9"),
                    app("数据库定时备份", "按计划备份 MySQL / SQL Server 数据库", "开发工具", 31000, "#6366f1"),
                    app("招聘网站简历收集", "自动筛选并下载符合条件的候选人简历", "数据采集", 28000, "#ec4899"),
                    app("报销单自动审核", "校验发票真伪与报销规则并生成台账", "财务税务", 23000, "#f59e0b"));
            repository.saveAll(apps);
            log.info("市场初始应用已写入：{} 条", apps.size());
        };
    }

    private static MarketApp app(String name, String desc, String category, long installs, String color) {
        MarketApp a = new MarketApp();
        a.setName(name);
        a.setDescription(desc);
        a.setCategory(category);
        a.setInstalls(installs);
        a.setColor(color);
        return a;
    }
}

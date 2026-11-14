# 后端镜像：多阶段构建（构建 + 运行）
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B -DskipTests package

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /build/target/leaf-rpa-service-0.1.0.jar app.jar
# 流程文件容器内存储目录
VOLUME /app/data/flows
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]

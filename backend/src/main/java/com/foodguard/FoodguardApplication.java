package com.foodguard;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling  // 에이전트 제안 만료 처리 (AgentProposalService)
public class FoodguardApplication {

	public static void main(String[] args) {
		SpringApplication.run(FoodguardApplication.class, args);
	}

}

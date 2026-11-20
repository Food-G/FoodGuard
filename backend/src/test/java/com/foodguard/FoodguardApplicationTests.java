package com.foodguard;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import javax.sql.DataSource;
import java.sql.Connection;

import static org.junit.jupiter.api.Assertions.*;

class FoodguardApplicationTests extends IntegrationTest {

	@Autowired
	private DataSource dataSource;

	@Test
	void contextLoadsOnInMemoryH2Only() throws Exception {
		try (Connection c = dataSource.getConnection()) {
			assertTrue(c.getMetaData().getURL().startsWith("jdbc:h2:mem:"));
		}
	}

	@Test
	void guardRefusesAnythingElseBeforeConnecting() {
		for (String url : new String[]{"jdbc:mysql://gateway.tidbcloud.com:4000/foodguard", "jdbc:h2:file:./fg", "", null}) {
			assertThrows(IllegalStateException.class, () -> IntegrationTest.assertInMemoryH2(url));
		}
	}
}

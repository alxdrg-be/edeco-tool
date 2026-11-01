package stirling.software.SPDF.config;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/** Every engine request, including static files, needs the per-process proxy secret. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public final class EdecoSessionFilter implements Filter {
    private final byte[] secret = System.getenv().getOrDefault("EDECO_ENGINE_SECRET", "").getBytes(StandardCharsets.UTF_8);

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest http = (HttpServletRequest) request;
        String value = http.getHeader("X-Edeco-Engine");
        if (secret.length < 32 || value == null || !MessageDigest.isEqual(secret, value.getBytes(StandardCharsets.UTF_8))) {
            ((HttpServletResponse) response).sendError(403);
            return;
        }
        chain.doFilter(request, response);
    }
}

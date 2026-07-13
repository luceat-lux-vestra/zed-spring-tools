package dev.zed.spring.s003;

import java.util.List;
import java.util.Map;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.jdt.ls.core.internal.IDelegateCommandHandler;

public final class SyntheticCommandHandler implements IDelegateCommandHandler {
    private static final String COMMAND_ID = "s003.synthetic.ping";

    @Override
    public Object executeCommand(
            String commandId,
            List<Object> arguments,
            IProgressMonitor monitor) {
        if (!COMMAND_ID.equals(commandId)) {
            throw new IllegalArgumentException("unexpected command ID");
        }
        if (arguments != null && !arguments.isEmpty()) {
            throw new IllegalArgumentException("arguments must be empty");
        }
        return Map.of("spike", "s003", "value", "ok-v1");
    }
}

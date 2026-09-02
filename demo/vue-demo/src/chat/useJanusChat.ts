import { ref, watch, onUnmounted, shallowRef } from "vue";
import {
  ChatController,
  type SessionState,
  type JanusChatOptions,
} from "@janus-scheduler/nlp";
import type { ChatMessage } from "@janus-scheduler/ui";

export interface JanusChatConversation {
  thread: ReadonlyArray<ChatMessage>;
  busy: boolean;
  session: SessionState | null;
  submit: (text: string) => void;
  choose: (label: string) => void;
  confirm: () => void;
  undo: (messageId: string) => void;
  reset: () => void;
  edit?: () => void;
}

export function useJanusChat(
  options: () => JanusChatOptions,
): JanusChatConversation {
  const controller = new ChatController(options());

  const thread = shallowRef<ReadonlyArray<ChatMessage>>(
    controller.thread as unknown as ChatMessage[],
  );
  const busy = ref(controller.busy);
  const session = ref<SessionState | null>(controller.session);

  const unsubscribe = controller.subscribe(() => {
    thread.value = [...controller.thread] as unknown as ChatMessage[];
    busy.value = controller.busy;
    session.value = controller.session;
  });

  watch(
    options,
    (newOptions) => {
      controller.updateOptions(newOptions);
    },
    { deep: true },
  );

  onUnmounted(() => {
    unsubscribe();
  });

  return {
    get thread() {
      return thread.value;
    },
    get busy() {
      return busy.value;
    },
    get session() {
      return session.value;
    },
    submit: (text: string) => controller.submit(text),
    choose: (label: string) => controller.choose(label),
    confirm: () => controller.confirm(),
    undo: (id: string) => controller.undo(id),
    reset: () => controller.reset(),
    edit: () => controller.edit(),
  };
}

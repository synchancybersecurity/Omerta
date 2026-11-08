import sys

with open(sys.argv[1], 'r') as f:
    content = f.read()

# Add imports if missing
if 'editOpenChatMessage' not in content or 'deleteOpenChatMessage' not in content:
    content = content.replace(
        "sendOpenChatMessage, getOpenChatMessages,",
        "sendOpenChatMessage, getOpenChatMessages, editOpenChatMessage, deleteOpenChatMessage,"
    )

# Add routes if missing
if "/api/open-chat/:id/edit" not in content:
    insert_after = "app.post('/api/open-chat', (req, res) => {"
    insert_idx = content.find(insert_after)
    if insert_idx != -1:
        insert_idx += len(insert_after)
        # Find end of the route block (closing of that function)
        route_block = """
\napp.put('/api/open-chat/:id/edit', (req, res) => {
  const content = req.body.content;
  if (!content) return res.status(400).json({ error: 'Missing content' });
  const msg = editOpenChatMessage(req.params.id, content);
  if (msg) {
    broadcast({ type: 'open_chat_edited', messageId: req.params.id, content: msg.content });
    res.json(msg);
  } else res.status(404).json({ error: 'Message not found' });
});

app.post('/api/open-chat/:id/delete', (req, res) => {
  const msg = deleteOpenChatMessage(req.params.id);
  if (msg) {
    broadcast({ type: 'open_chat_deleted', messageId: req.params.id });
    res.json({ success: true });
  } else res.status(404).json({ error: 'Message not found' });
});"""
        content = content[:insert_idx] + route_block + content[insert_idx:]

with open(sys.argv[1], 'w') as f:
    f.write(content)

print("Done")

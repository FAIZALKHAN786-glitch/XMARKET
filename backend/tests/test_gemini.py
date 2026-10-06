"""No-network Gemini integration regressions.
Run: backend/.venv/bin/python -m unittest discover -s backend/tests -v
"""
import unittest
from unittest.mock import AsyncMock, patch

import httpx
from pydantic import BaseModel
from backend.app.config import Config
from backend.app import llm


class GeminiTests(unittest.IsolatedAsyncioTestCase):
    async def probe(self, payload, status=200, model="gemini-3.5-flash-lite"):
        cfg = Config(gemini_api_key="test-key", gemini_model=model)
        response = httpx.Response(status, json=payload)
        with patch.object(httpx.AsyncClient, "post", new=AsyncMock(return_value=response)) as post, \
             patch.object(llm, "write_cache") as write:
            result = await llm.health(cfg)
            write.assert_not_called()
            return result, post.call_args

    def test_default_model(self):
        self.assertEqual(Config().gemini_model, "gemini-3.5-flash-lite")
        self.assertEqual(llm._thinking_config(Config()), {"thinkingLevel": "low"})

    async def test_configured_model_is_preserved(self):
        result, call = await self.probe({"candidates": [{"content": {"parts": [{"text": "ok"}]}}]})
        self.assertTrue(result["ok"])
        # This is a mock model ID, NOT proof that Google offers it.
        self.assertIn("gemini-3.5-flash-lite:generateContent", call.args[0])
        self.assertEqual(call.kwargs["headers"]["x-goog-api-key"], "test-key")
        self.assertEqual(call.kwargs["json"]["generationConfig"]["maxOutputTokens"], 2048)

    async def test_empty_blocked_and_thought_only_are_not_online(self):
        for payload in [{}, {"promptFeedback": {"blockReason": "SAFETY"}},
                        {"candidates": [{"content": {"parts": [{"thought": True, "text": "reasoning"}]}}]}]:
            result, _ = await self.probe(payload)
            self.assertFalse(result["ok"])
            self.assertEqual(result["code"], "unprocessable")

    async def test_provider_errors(self):
        for status, code in [(403, "auth"), (429, "rate_limited"), (404, "bad_request"), (503, "upstream")]:
            result, _ = await self.probe({"error": {"message": "Rejected"}}, status)
            self.assertFalse(result["ok"])
            self.assertEqual(result["code"], code)

    async def test_missing_key_does_not_call_google(self):
        with patch.object(httpx.AsyncClient, "post", new=AsyncMock()) as post:
            self.assertFalse((await llm.health(Config()))["ok"])
            post.assert_not_called()

    async def test_invalid_structured_output_retries_then_validates(self):
        class Answer(BaseModel):
            ok: bool
        with patch.object(llm, "_call_provider", new=AsyncMock(side_effect=['{"wrong": 1}', '{"ok":true}'])) as call:
            result = await llm.chat(Config(gemini_api_key="test-key"),
                                    [{"role": "user", "content": "Extract"}],
                                    schema=Answer, no_cache=True)
            self.assertEqual(result.value, {"ok": True})
            self.assertEqual(call.await_count, 2)

    def test_payload_and_extraction(self):
        body = llm._gemini_body(Config(gemini_model="gemini-2.5-flash"), [
            {"role": "system", "content": "Extract data"},
            {"role": "user", "content": "hello"},
            {"role": "assistant", "content": "hi"},
        ], {"schema": True})
        self.assertEqual(body["generationConfig"]["thinkingConfig"], {"thinkingBudget": 0})
        self.assertEqual(body["generationConfig"]["responseMimeType"], "application/json")
        self.assertEqual(body["contents"][1]["role"], "model")
        self.assertEqual(body["systemInstruction"]["parts"][0]["text"], "Extract data")
        self.assertEqual(llm._extract_text({"candidates": [{"content": {"parts": [
            {"thought": True, "text": "private"}, {"text": "answer"}
        ]}}]}), "answer")


if __name__ == "__main__":
    unittest.main()

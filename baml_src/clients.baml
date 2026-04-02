client<llm> GPT5 {
  provider openai
  retry_policy Exponential
  options {
    model "gpt-5"
    api_key env.OPENAI_API_KEY
  }
}

client<llm> GPT5Mini {
  provider openai
  retry_policy Exponential
  options {
    model "gpt-5-mini"
    api_key env.OPENAI_API_KEY
  }
}

client<llm> GeminiFlash {
  provider google-ai
  retry_policy Exponential
  options {
    model "gemini-3-flash-preview"
    api_key env.GOOGLE_API_KEY
  }
}

client<llm> GeminiFlashWithFallback {
  provider fallback
  options {
    strategy [
      GeminiFlash
      GPT5Mini
    ]
  }
}


retry_policy Exponential {
  max_retries 2
  // Strategy is optional
  strategy {
    type exponential_backoff
    delay_ms 300
    multiplier 1.5
    max_delay_ms 10000
  }
}
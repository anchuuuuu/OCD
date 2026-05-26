from huggingface_hub import hf_hub_download

print("Downloading Phi-3-Mini (~2.2GB). This may take a moment depending on your internet connection...")
model_path = hf_hub_download(
    repo_id="microsoft/Phi-3-mini-4k-instruct-gguf",
    filename="Phi-3-mini-4k-instruct-q4.gguf",
    local_dir="."
)
print(f"Download complete! Model saved to {model_path}")

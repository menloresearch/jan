# Regression test

**Release Version:** v0.6.0

**Operating System:**

---

## A. Installation, Update, and Uninstallation

### 1. Users install app (New user flow)

- [ ] :rocket: The installation package is not corrupted and passes all security checks.
- [ ] :key: The app launches successfully after installation.

### 2. Users update app (Existing user flow)

- [ ] :key: Validate that the update does not corrupt user data or settings.
- [ ] :key: App restarts or prompts the user to restart after an update.
- [ ] When updating the app, check if the `/models` directory has any JSON/YML files that change according to the update.
- [ ] Updating the app also updates extensions correctly, test functionality changes.
- [ ] All data, threads, configurations, etc… migration to new UI after upgraded version.

### 3. Users uninstall / close app

- [ ] :key: After closing the app, all models are unloaded.
- [ ] :key::warning: Uninstallation process removes the app successfully from the system.
- [ ] Clean the data folder and open the app to check if it creates all the necessary folders, especially models and extensions.

### 4. Migration data & Upgrade version 

#### 4.1 Migration data

- [ ] :Local model kept (Downloaded & Imported)
- [ ] :API keys for remote models kept
- [ ] :Imported models (GGUF file or folder) should be displayed in the list
- [ ] :Models added from Hugging Face should appear in the Hub 
  - [ ] :Cortexso model
  - [ ] :HF model (eg: unsloth models)
- [ ] :Llama.cpp  information should be retained after upgrade 
  - [ ] :HF token 
- [ ] :Config HTTP Proxy should be retained shouldn’t be migrated after upgrade
- [ ] :Ensure threads & chat migrated and work fine 
- [ ] :Ensure the Local API Server shouldn’t be migrated and work fine
- [ ] :Ensure app log location remains unchanged
- [ ] :Ensure model starts/loads correctly with CPU/GPU backend without error
  - [ ] :Toggle GPUs 
- [ ] :Ensure API functions correctly
- [ ] :Ensure search/download model function work fine

#### 4.2 Upgrade version 

- [ ] :Electron to tauri (v0.5.17 -> latest tauri version)
- [ ] :Tauri to tauri (v0.6.1 -> latest tauri version)

## B. Settings

### 1. General

- [ ] :Users can click on the Reset button to factory reset app settings to its original state & delete all usage data. 
- [ ] :The app should update its language to match the selected language.
- [ ] :Verify that the 'Community' and 'Support' options navigate to the correct URLs.

### 2. Appearance

- [ ] :Test the Light, Dark, and System theme settings to ensure they are functioning as expected.
- [ ] :Confirm that the application saves the theme preference and persists it across sessions.
- [ ] :Validate that all elements of the UI are compatible with the theme changes and maintain legibility and contrast.
- [ ] :Confirm that the application saves the color and persists it across sessions (Window Background, App main view, Primary, Accent, Destructive).
- [ ] :Confirm that the application saves the code style and persists it across sessions.
- [ ] :Confirm that the application saves the font size  and persists it across sessions.
- [ ] :Users can click on Reset button to reset app original color/code style.

### 3. Model Providers

- [ ] :Can add a new provider and model with API key/token in correct format.
- [ ] :Model list is displayed correctly after successful addition.
- [ ] :Can edit and delete individual models/providers without crashing the UI.
- [ ] :Action icons (edit, delete, set default) work properly.
- [ ] :Automatically update the active model when selecting another model.
- [ ] :Model loading status (Start, Stop) is clearly displayed.
- [ ] :Can import .gguf models without errors.
  - [ ] :Import by file GGUF.
  - [ ] :Import same name model different repo.
- [ ] :When selecting a local model, check:
  - [ ] :The engine has been started.
  - [ ] :The app does not crash if the model is too heavy.
  - [ ] :RAM usage is stable (hardware).
- [ ] :Automatically stop old models when loading new models (Auto-unload works).
- [ ] :If Context Shift is enabled, ensure important context is not lost when replying long.
- [ ] :Chat works fine with all models in the list.
- [ ] :Batching works properly if enabled (multi prompt send).
- [ ] :When the model provider is disconnected or loses internet connection, the error message is clear.
- [ ] :Try to intentionally use the wrong token to ensure the app is stable and shows the correct error.
- [ ] :Disable the provider => ensure the related model is hidden or not available.
- [ ] :The app does not crash when loading many models continuously (stress test).

### 4. Shortcuts

- [ ] :key: Test each shortcut key to confirm it works as described (My models, navigating, opening, closing, etc.)
- [ ] :key: Ensure that keyboard shortcuts are shown for each available function within the application.

### 5. Hardware
- [ ] :Verify that all system information including OS, CPU, Memory, and GPUs are displayed correctly based on the user's machine.
- [ ] :Ensure that the current usage percentages of CPU and GPU are shown accurately when the user is chatting with models.
- [ ] :Verify that the model name, provider, uptime, and available actions are displayed correctly when a model is started.
- [ ] :Test enabling and disabling GPUs to ensure that chat functionality works as expected.
- [ ] :Enabling/disabling Vulkan in session does not affect other parts (inference, model loading).

### 6. MCP Servers

- [ ] :Create an MCP server successfully.
- [ ] :Check if the delete server button is working, the server disappears without reporting an error.
- [ ] :Check if the command/args/env is edited and the content is updated correctly.
- [ ] :Check if the server toggle button is working properly, not in the wrong state.
- [ ] :Check if the key in Env is exposed (must be hidden as *****)
- [ ] :Ensure MCP servers automatically start when opening Jan.
- [ ] :Ensure chat works properly with the MCP servers.
- [ ] :Test with multiple MCP servers running simultaneously.
- [ ] :Turn off MCP server → assistant cannot call tool even if requested.
- [ ] :If Allow All MCP Tool Permissions is off → tool must ask for confirmation before call.
- [ ] :If permission is denied → assistant cannot execute tool.
- [ ] :If ENV key is missing (eg Serper) → error must be reported clearly, UI must not crash.

### 7. Local API Server

- [ ] :Explore API Reference: Swagger API for sending/receiving requests.
- [ ] :Use default server option.
- [ ] :Configure and use custom server options.
- [ ] :Server logs captured correct each APIs call .
- [ ] :Verify functionality of Open logs.
- [ ] :Ensure that other threads and functions work properly while the local server is running.
- [ ] :Chat completion (127.0.0.1; 0.0.0.0):
  - [ ] :Threads.
  - [ ] :Models.
  - [ ] :Ensure chat works correctly with Jan model hosted on machine A, used from machine B.

### 8. HTTP Proxy
- [ ] :Attempt to test downloading model from hub using HTTP Proxy guideline.
- [ ] :Ensure that the SSL Verification and Proxy configuration settings are displayed correctly according to the design.

### 9. Entensions
- [ ] :Verify that all extensions are properly listed and function as expected within the Jan.
- [ ] :Ensure that all links navigate to their intended URLs, if any are present.

## C. HUB

- [ ] :key: Each model's recommendations are from cortexSO.
- [ ] :key: Search models and verify results / action on the results.
- [ ] :key: Check the download model functionality and validate if the cancel download feature works correctly.
- [ ] :key: Verify that the list variants show enough and correct with each model.
- [ ] :key: Import via Hugging Face Id / full HuggingFace URL, check the progress bar reflects the download process #1740.
- [ ] :key: Ensure that navigate to New Thread when clicking use button.
- [ ] :key: Filter list model matching with Newest, Most downloaded.
- [ ] :key: Model download will displayed when turn on Downloaded.
- [ ] :key: Confirm that the deleted model is no longer displayed under the Downloaded section in the Hub tab.

## D. Thread & Chat

### 1. Threads

- [ ] :Conversation thread is maintained without any loss of data upon sending multiple messages.
- [ ] :Appropriate error handling and messaging if the assistant fails to respond.
- [ ] :Check the create new chat button, and the new conversation will have an automatically generated thread title based on users msg.
- [ ] :Changing models mid-thread the app can still handle it.
- [ ] :Check the regenerate button to renew the response (single / multiple times).
- [ ] :Check the Instructions update correctly after the user updates it midway (mid-thread).
- [ ] :The chat window displays the entire conversation from the selected history thread without any missing messages.
- [ ] :Historical threads reflect the exact state of the chat at that time, including settings.
- [ ] :Ability to delete old threads.
- [ ] :Changing the title of the thread updates correctly.
- [ ] :Ensure that starred threads are correctly categorized under Favorites and Recent as separate fields.
- [ ] :Verify that the Delete All action works independently for each field.
- [ ] :Ensure that the search thread feature returns accurate results based on thread titles, content (Exact matches, Partial matches, Case-insensitive queries).

### 2. Chat

- [ ] :Sending a message enables users to receive responses from the model.
- [ ] :Test for the ability to send different types of messages (e.g., text, emojis, code blocks).
- [ ] :Verify that the model can generate responses in a structured table format.
- [ ] :Test the model’s ability to handle and display long-form responses.
- [ ] :Verify that the model can summarize content accurately and concisely.
- [ ] :Test the model’s ability to generate code snippets to ensure syntax highlighting, line formatting, and horizontal scrolling for long lines.
- [ ] :Check the output format of the AI (code blocks, JSON, markdown, ...).
- [ ] :Users should be able to edit msg and the assistant will re-generate the answer based on 
- [ ] :Validate the scroll functionality in the chat window for lengthy conversations.
- [ ] :User can copy / delete the response.
- [ ] :Check the clear message / delete entire chat button works
- [ ] :Test assistant's ability to maintain context over multiple exchanges.

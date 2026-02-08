#!/usr/bin/env python3
"""
Automated script to fix Telugu translation in tutor_backend_multilingual.py
This replaces the Telugu prompt with English and enables proper translation.
"""

import re

def fix_backend_file():
    """Fix the backend file to use English prompts and translation"""

    file_path = 'tutor_backend_multilingual.py'

    print(f"📝 Reading {file_path}...")

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find and replace the Telugu prompt section (lines ~851-888)
    # Pattern: Find the Telugu prompt block
    telugu_prompt_pattern = r'        if self\.language == \'telugu\':\s+prompt = f""".*?""".*?else:\s+prompt = f"""You are an intelligent AI tutor.*?"""'

    replacement = '''        # ALWAYS use English prompt (translation happens at the end for Telugu)
        # If textbook has no relevant info, use general knowledge
        prompt = f"""You are an intelligent AI tutor helping a student.

Student Question: "{question}"

Textbook Content Available:
{context}

Your Task:
{task_instr}

IMPORTANT INSTRUCTIONS:
1. Answer in clear, simple English
2. If the textbook content above doesn't fully answer the question, USE YOUR GENERAL KNOWLEDGE to provide a complete answer
3. Do NOT say "this is not in your textbook" - just answer the question using what you know
4. Jump STRAIGHT into the answer
5. Do NOT repeat textbook headings
6. Provide accurate, educational information

Answer:"""'''

    # Check if pattern exists
    if re.search(telugu_prompt_pattern, content, re.DOTALL):
        print("✅ Found Telugu prompt section")
        content = re.sub(telugu_prompt_pattern, replacement, content, flags=re.DOTALL)
        print("✅ Replaced Telugu prompt with English prompt")
    else:
        print("⚠️ Telugu prompt pattern not found - checking alternative pattern...")

        # Alternative: Just replace the Telugu if block
        alt_pattern = r"        if self\.language == 'telugu':\s+prompt = f\"\"\"మీరు.*?ఇవ్వండి:\s+\"\"\""

        if re.search(alt_pattern, content, re.DOTALL):
            print("✅ Found Telugu prompt block (alternative pattern)")
            # Keep the else block, just remove the Telugu if
            content = re.sub(
                r"        if self\.language == 'telugu':.*?(?=        else:)",
                "        # Telugu uses same English prompt\n        if False:  # Disabled - use English always\n            pass\n",
                content,
                flags=re.DOTALL,
                count=1
            )
            print("✅ Disabled Telugu prompt block")
        else:
            print("❌ Could not find Telugu prompt - manual fix needed")
            return False

    # Write back
    print(f"💾 Writing changes back to {file_path}...")
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print("✅ File updated successfully!")
    print("\n🎉 Translation fix applied!")
    print("\nNext steps:")
    print("1. Restart backend: python run_app.py")
    print("2. Test with Telugu question")
    print("3. Should get clean Telugu translation now!")

    return True

if __name__ == '__main__':
    print("🔧 Telugu Translation Fix Script")
    print("=" * 50)

    try:
        success = fix_backend_file()
        if success:
            print("\n✅ SUCCESS! Backend file fixed.")
        else:
            print("\n⚠️ Manual fix required. See TELUGU_TRANSLATION_IMPLEMENTATION.md")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("Manual fix required. See TELUGU_TRANSLATION_IMPLEMENTATION.md")

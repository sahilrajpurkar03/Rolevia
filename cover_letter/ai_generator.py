"""
AI-Powered Cover Letter Generator
==================================
Uses AI to analyze job descriptions and generate personalized cover letters
following a specific 3-paragraph structure.
"""

from __future__ import annotations

import re
import subprocess
import shutil
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional

from cv_data import PERSONAL, EXPERIENCES, PROJECTS


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# AI Content Generation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def generate_ai_cover_letter(
    job: dict,
    availability: str = "1st October 2026",
) -> dict:
    """
    Generate cover letter content using AI to analyze job and create personalized content.
    
    Returns:
        {
            'intro_line': str,      # One line describing experience/passion
            'connection': str,      # 2-3 lines connecting to job requirements
            'closing': str,         # Location, availability, thank you
        }
    """
    title = job.get("title", "")
    company = job.get("company", "")
    description = job.get("description", "")
    keywords = job.get("keywords", [])
    
    # Build context from experiences and projects for AI to reference
    experience_context = _build_experience_context()
    project_context = _build_project_context()
    
    # Generate personalized content
    intro_line = _generate_intro_line(title, company, keywords)
    connection = _generate_connection_paragraph(
        title, company, description, keywords, 
        experience_context, project_context
    )
    closing = _generate_closing_paragraph(availability)
    
    return {
        "intro_line": intro_line,
        "connection": connection,
        "closing": closing,
    }


def _build_experience_context() -> str:
    """Build a summary of experiences for AI context."""
    context_parts = []
    for exp in EXPERIENCES[:3]:  # Top 3 experiences
        context_parts.append(
            f"- {exp['title']} at {exp['company']} ({exp['period']}): "
            f"{exp.get('text_general', '')}"
        )
    return "\n".join(context_parts)


def _build_project_context() -> str:
    """Build a summary of projects for AI context."""
    context_parts = []
    for proj in PROJECTS[:2]:  # Top 2 projects
        context_parts.append(
            f"- {proj['title']}: {proj.get('text_general', '')}"
        )
    return "\n".join(context_parts)


def _generate_intro_line(title: str, company: str, keywords: List[str]) -> str:
    """
    Generate introduction line emphasizing passion and capability.
    Should avoid technical jargon, focus on making AI physical, working with robots.
    
    Example outputs:
    - "a robotics engineer passionate about bringing AI to life through physical systems"
    - "a robotics engineer who transforms cutting-edge research into real-world robot applications"
    - "an engineer dedicated to bridging the gap between autonomous systems and practical deployment"
    """
    
    # Analyze job title and keywords for better matching
    title_lower = title.lower()
    kw_set = {k.lower() for k in keywords}
    
    # Detect job characteristics
    is_application_focused = any(term in title_lower for term in ["application", "applikation", "field", "deployment", "integration"])
    is_research_focused = any(term in title_lower for term in ["research", "development", "r&d", "innovation", "scientist"])
    is_mobile_robotics = any(term in title_lower for term in ["mobile", "autonomous", "amr", "navigation"])
    is_manipulation = any(term in title_lower for term in ["manipulation", "grasper", "pick"])
    is_software = any(term in title_lower for term in ["software", "developer", "programmer"])
    
    # Select intro line based on job type
    if is_application_focused:
        return "a robotics engineer who turns advanced technology into practical, deployed solutions"
    elif is_mobile_robotics:
        return "a robotics engineer passionate about developing intelligent mobile systems that work in the real world"
    elif is_manipulation:
        return "a robotics engineer focused on bringing advanced manipulation capabilities from research to reality"
    elif is_software:
        return "a robotics software engineer dedicated to building robust autonomous systems"
    elif is_research_focused:
        return "a robotics engineer who bridges cutting-edge research and real-world implementation"
    else:
        # Default options - variety based on keywords
        if "autonomous" in kw_set or "mobile" in kw_set:
            return "a robotics engineer passionate about bringing AI to life through autonomous systems"
        elif "simulation" in kw_set or "digital twin" in kw_set:
            return "a robotics engineer who validates and deploys intelligent systems from simulation to reality"
        elif "perception" in kw_set or "sensor" in kw_set:
            return "a robotics engineer specializing in making robots perceive and interact with their environment"
        else:
            return "a robotics engineer dedicated to developing practical solutions for intelligent autonomous systems"


def _generate_connection_paragraph(
    title: str,
    company: str,
    description: str,
    keywords: List[str],
    experience_context: str,
    project_context: str,
) -> str:
    """
    Generate 2-3 line paragraph connecting candidate's background to job requirements.
    Should reference specific experience and express genuine interest.
    
    This analyzes the job and finds relevant experience to highlight.
    """
    
    # Combine title, description and keywords for analysis
    job_text_lower = f"{title} {description}".lower()
    kw_lower = [k.lower() for k in keywords]
    
    # Analyze which experiences are most relevant
    relevant_exp = _find_relevant_experience(keywords)
    relevant_proj = _find_relevant_project(keywords)
    
    # Build connection paragraph with specific details
    lines = []
    
    # Detect job focus areas
    is_mobile_robotics = any(term in job_text_lower for term in ["mobile robot", "autonomous mobile", "amr", "agv", "mobile platform"])
    is_navigation = any(term in job_text_lower for term in ["navigation", "localization", "mapping", "slam"])
    is_manipulation = any(term in job_text_lower for term in ["manipulation", "grasping", "pick", "gripper"])
    is_ros = any(term in job_text_lower for term in ["ros", "ros2"])
    is_simulation = any(term in job_text_lower for term in ["simulation", "isaac", "gazebo", "digital twin"])
    is_ai_ml = any(term in job_text_lower for term in ["machine learning", "deep learning", "ai", "neural", "detection"])
    is_sensor = any(term in job_text_lower for term in ["lidar", "camera", "radar", "sensor fusion"])
    
    # Build personalized opening based on job focus
    if is_mobile_robotics or is_navigation:
        lines.append(
            f"This role aligns perfectly with my hands-on experience "
            f"developing autonomous mobile robot systems at Porsche Engineering."
        )
        if relevant_exp and "porsche" in relevant_exp.get("id", ""):
            lines.append(
                "Working with humanoid, quadruped, and wheeled mobile platforms has given me direct "
                "experience with the navigation, localization, and mapping challenges central to mobile robotics."
            )
        else:
            lines.append(
                "My experience spans multiple robot platforms including navigation system development "
                "and real-world deployment challenges."
            )
    elif is_manipulation:
        lines.append(
            f"I am excited about this opportunity, as manipulation and motion planning "
            f"were core focuses during my research at TU Dortmund."
        )
        lines.append(
            "Building dual-arm systems with ROS2 MoveIt and deploying them in real applications "
            "has prepared me well for the challenges ahead."
        )
    elif is_ai_ml or is_sensor:
        lines.append(
            f"This position is particularly interesting to me given my ML-based perception work."
        )
        if relevant_proj and "thesis" in relevant_proj.get("id", ""):
            lines.append(
                "My Master's thesis on radar-based object detection and my LiDAR perception projects "
                "align directly with the sensor-based AI systems this role focuses on."
            )
        else:
            lines.append(
                "My background in sensor fusion and ML-based object detection directly supports "
                "the technical requirements outlined."
            )
    elif is_ros or is_simulation:
        lines.append(
            f"This opportunity would be an ideal match for my ROS2 and simulation expertise."
        )
        lines.append(
            "At Porsche Engineering, I validate robot behavior in NVIDIA Isaac Sim and MuJoCo before deployment, "
            "which aligns closely with your development workflow."
        )
    else:
        # Generic but still personalized
        lines.append(
            f"This position is an excellent match for my robotics engineering background."
        )
        if relevant_exp and "porsche" in relevant_exp.get("id", ""):
            lines.append(
                "My current work developing and validating autonomous systems across multiple robot platforms "
                "has prepared me well for the technical challenges ahead."
            )
        else:
            lines.append(
                "My blend of industry experience and research background positions me to contribute "
                "meaningfully from the start."
            )
    
    # Add contribution statement if we only have 1-2 sentences
    if len(lines) < 3:
        lines.append(
            f"I am confident I can make immediate contributions and help advance {company}'s robotics capabilities."
        )
    
    # Return exactly 2-3 sentences
    return " ".join(lines[:3])


def _generate_closing_paragraph(availability: str) -> str:
    """
    Generate closing paragraph with location, availability, and thank you.
    This is mostly standardized with variable availability date.
    """
    return (
        f"I am based in Mönsheim, Germany (near Stuttgart), and open to relocation across Germany. "
        f"I am available from {availability} and would welcome the opportunity to discuss "
        f"my application in a personal interview. Thank you for your consideration."
    )


def _find_relevant_experience(keywords: List[str]) -> Optional[dict]:
    """Find the most relevant experience based on keywords."""
    kw_lower = {k.lower() for k in keywords}
    
    scored_exps = []
    for exp in EXPERIENCES:
        matches = sum(1 for tag in exp.get("tags", []) if tag.lower() in kw_lower)
        scored_exps.append((matches * exp.get("base_weight", 1), exp))
    
    scored_exps.sort(key=lambda x: x[0], reverse=True)
    return scored_exps[0][1] if scored_exps else None


def _find_relevant_project(keywords: List[str]) -> Optional[dict]:
    """Find the most relevant project based on keywords."""
    kw_lower = {k.lower() for k in keywords}
    
    scored_projs = []
    for proj in PROJECTS:
        matches = sum(1 for tag in proj.get("tags", []) if tag.lower() in kw_lower)
        scored_projs.append((matches, proj))
    
    scored_projs.sort(key=lambda x: x[0], reverse=True)
    return scored_projs[0][1] if scored_projs else None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Renderers
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def render_text_ai(
    job: dict,
    availability: str,
    ref: str = "",
) -> str:
    """Build the ATS-safe plain-text cover letter using AI-generated content."""
    p = PERSONAL
    today = datetime.now().strftime("%d %B %Y")
    
    title = job.get("title", "")
    company = job.get("company", "")
    location = job.get("location", "")
    
    # Generate AI content
    ai_content = generate_ai_cover_letter(job, availability)
    
    subject_ref = f" (Ref: {ref})" if ref else ""
    subject = f"Application for {title}{subject_ref}"
    
    lines = [
        p["name"],
        p["address"],
        p["phone"],
        p["email"],
        p["linkedin"],
        "",
        today,
        "",
    ]
    
    if company:
        lines.append(company)
    if location and location not in ("—", "-", ""):
        lines.append(location)
    lines += ["", f"Subject: {subject}", "", "Dear Hiring Team,", ""]
    
    # Paragraph 1: Opening with intro line
    lines.append(
        f"I am writing to apply for the {title} position at {company}. "
        f"I am {ai_content['intro_line']}."
    )
    lines.append("")
    
    # Paragraph 2: Connection to job
    lines.append(ai_content["connection"])
    lines.append("")
    
    # Paragraph 3: Closing
    lines.append(ai_content["closing"])
    lines += ["", "Sincerely,", "", p["name"]]
    
    return "\n".join(lines)


def _tex_escape(text: str) -> str:
    """Escape special LaTeX characters in plain text."""
    replacements = [
        ("\\", r"\textbackslash{}"),
        ("&",  r"\&"),
        ("%",  r"\%"),
        ("$",  r"\$"),
        ("#",  r"\#"),
        ("_",  r"\_"),
        ("{",  r"\{"),
        ("}",  r"\}"),
        ("~",  r"\textasciitilde{}"),
        ("^",  r"\textasciicircum{}"),
        ("–",  r"--"),
        ("—",  r"---"),
    ]
    for old, new in replacements:
        text = text.replace(old, new)
    return text


def render_latex_ai(
    job: dict,
    availability: str,
    ref: str = "",
) -> str:
    """Build the LaTeX source using AI-generated content."""
    p = PERSONAL
    
    title = job.get("title", "")
    company = job.get("company", "")
    location = job.get("location", "")
    
    # Generate AI content
    ai_content = generate_ai_cover_letter(job, availability)
    
    subject_ref = f" (Ref: {_tex_escape(ref)})" if ref else ""
    subject = f"Application for {_tex_escape(title)}{subject_ref}"
    
    # Build paragraphs
    para1 = _tex_escape(
        f"I am writing to apply for the {title} position at {company}. "
        f"I am {ai_content['intro_line']}."
    )
    para2 = _tex_escape(ai_content["connection"])
    para3 = _tex_escape(ai_content["closing"])
    
    recipient_lines = []
    if company and company not in ("—", "-", ""):
        recipient_lines.append(_tex_escape(company))
    if location and location not in ("—", "-", ""):
        recipient_lines.append(_tex_escape(location))
    recipient_block = " \\\\\n".join(recipient_lines) if recipient_lines else ""
    
    tex = r"""\documentclass[a4paper,11pt]{article}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage[top=2.5cm, bottom=2.5cm, left=2.8cm, right=2.8cm]{geometry}
\usepackage{parskip}
\usepackage{lmodern}
\usepackage[hidelinks]{hyperref}
\pagestyle{empty}
\setlength{\parskip}{0.9em}

\begin{document}

%% ── Header ──────────────────────────────────────────────────────────────
\begin{flushright}
  \textbf{""" + _tex_escape(p["name"]) + r"""} \\
  """ + _tex_escape(p["address"]) + r""" \\
  """ + _tex_escape(p["phone"]) + r""" \\
  \href{mailto:""" + p["email"] + r"""}{""" + _tex_escape(p["email"]) + r"""} \\
  \href{https://""" + p["linkedin"] + r"""}{""" + _tex_escape(p["linkedin"]) + r"""}
\end{flushright}

\today

%% ── Recipient ───────────────────────────────────────────────────────────
""" + (recipient_block + "\n\n" if recipient_block else "") + r"""
\textbf{""" + subject + r"""}

Dear Hiring Team,

""" + para1 + r"""

""" + para2 + r"""

""" + para3 + r"""

\vspace{1.2em}
Sincerely,

\vspace{1.5em}
\textbf{""" + _tex_escape(p["name"]) + r"""}

\end{document}
"""
    return tex


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PDF Compilation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def compile_pdf(tex_path: Path) -> Optional[Path]:
    """
    Run pdflatex on tex_path. Returns the PDF path on success, else None.
    """
    pdflatex = shutil.which("pdflatex")
    if not pdflatex:
        return None
    
    try:
        result = subprocess.run(
            [pdflatex, "-interaction=nonstopmode", "-output-directory",
             str(tex_path.parent), str(tex_path)],
            capture_output=True, text=True, timeout=60
        )
        pdf = tex_path.with_suffix(".pdf")
        if result.returncode == 0 and pdf.exists():
            # Remove auxiliary files
            for ext in (".aux", ".log", ".out"):
                tex_path.with_suffix(ext).unlink(missing_ok=True)
            return pdf
    except Exception:
        pass
    return None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Main Generate Function
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _safe_filename(text: str, max_len: int = 30) -> str:
    """Convert arbitrary text to a safe filename component."""
    text = re.sub(r"[^\w\s-]", "", text).strip().lower()
    text = re.sub(r"[\s_-]+", "_", text)
    return text[:max_len]


def generate_ai(
    job: dict,
    availability: str,
    ref: str,
    output_dir: Path,
) -> dict:
    """
    Generate AI-powered cover letter files and return a dict of paths.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    
    first_name = PERSONAL.get("name", "user").lower().split()[0]
    base_name = f"cl_{first_name}"
    
    # Plain text
    txt_path = output_dir / f"{base_name}.txt"
    txt_path.write_text(render_text_ai(job, availability, ref), encoding="utf-8")
    
    # LaTeX
    tex_path = output_dir / f"{base_name}.tex"
    tex_path.write_text(render_latex_ai(job, availability, ref), encoding="utf-8")
    
    # Try to compile PDF
    pdf_path = compile_pdf(tex_path)
    
    return {
        "txt": txt_path,
        "tex": tex_path,
        "pdf": pdf_path,
        "base_name": base_name,
    }

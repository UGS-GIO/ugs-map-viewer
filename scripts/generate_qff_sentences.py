#!/usr/bin/env python3
"""
Generate all QFF (Quaternary Fault Feature) sentence permutations.

Run with: python scripts/generate_qff_sentences.py

Outputs CSV and JSON files with all possible sentence combinations.
"""

import csv
import json
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import Optional

# Domain values from GeoServer (hazards:quaternaryfaults_test)
DOMAIN_VALUES = {
    "slipsense": ["normal", "monocline", "unknown", "anticline", "reverse"],
    "faultage": ["<15,000", "<2,600,000", "<130,000", "<750,000", "undetermined", "<150"],
    "sliprate": ["<0.2 mm/yr", "0.2 - 1 mm/yr", "1 - 5 mm/yr", "unspecified", "Undetermined", ">5 mm/yr"],
    "mappedscale": [
        "1:10,000", "1:24,000", "1:100,000", "1:250,000", "1:62,500",
        "1:125,000", "1:50,000", "1:155,000", "1:60,000", "1:170,000",
        "1:340,000", "1:500,000", "1:700,000", "1:750,000"
    ]
}

FOLD_STRUCTURES = ["anticline", "monocline", "syncline"]

NAMES_PLACEHOLDER = "{faultZone} {faultName} {sectionName} {strandName}"


@dataclass
class SentencePermutation:
    id: int
    template: str  # 'fold_structure', 'undetermined_age', or 'known_age'
    slipsense: str
    mappedscale: str
    faultage: Optional[str]
    sliprate: Optional[str]
    sentence: str


def generate_sentence(
    slipsense: str,
    mappedscale: str,
    faultage: Optional[str],
    sliprate: Optional[str]
) -> tuple[str, str]:
    """Generate a sentence based on the input parameters.

    Returns:
        Tuple of (template_name, sentence)
    """
    is_fold_structure = slipsense.lower() in FOLD_STRUCTURES

    if is_fold_structure:
        sentence = (
            f"{NAMES_PLACEHOLDER} is a {slipsense} that was mapped at {mappedscale} scale. "
            f"Geologic studies have determined that the structure has had movement in the "
            f"last {faultage} years and has a slip rate of {sliprate}."
        )
        return ("fold_structure", sentence)

    elif faultage and faultage.lower() == "undetermined":
        sentence = (
            f"{NAMES_PLACEHOLDER} is a {slipsense} fault that was mapped at {mappedscale} scale. "
            f"Geologic studies have not determined the age or slip rate of the fault."
        )
        return ("undetermined_age", sentence)

    else:
        sentence = (
            f"{NAMES_PLACEHOLDER} is a {slipsense} fault that was mapped at {mappedscale} scale. "
            f"Geologic studies have determined that the fault has had movement in the "
            f"last {faultage} years and has a slip rate of {sliprate}."
        )
        return ("known_age", sentence)


def generate_all_permutations() -> list[SentencePermutation]:
    """Generate all possible sentence permutations."""
    permutations = []
    id_counter = 1

    for slipsense in DOMAIN_VALUES["slipsense"]:
        is_fold_structure = slipsense.lower() in FOLD_STRUCTURES

        for mappedscale in DOMAIN_VALUES["mappedscale"]:
            if is_fold_structure:
                # Fold structures use all faultage and sliprate combinations
                for faultage in DOMAIN_VALUES["faultage"]:
                    for sliprate in DOMAIN_VALUES["sliprate"]:
                        template, sentence = generate_sentence(slipsense, mappedscale, faultage, sliprate)
                        permutations.append(SentencePermutation(
                            id=id_counter,
                            template=template,
                            slipsense=slipsense,
                            mappedscale=mappedscale,
                            faultage=faultage,
                            sliprate=sliprate,
                            sentence=sentence
                        ))
                        id_counter += 1
            else:
                # Non-fold structures
                for faultage in DOMAIN_VALUES["faultage"]:
                    if faultage.lower() == "undetermined":
                        # Undetermined age - no sliprate needed
                        template, sentence = generate_sentence(slipsense, mappedscale, faultage, None)
                        permutations.append(SentencePermutation(
                            id=id_counter,
                            template=template,
                            slipsense=slipsense,
                            mappedscale=mappedscale,
                            faultage=faultage,
                            sliprate=None,
                            sentence=sentence
                        ))
                        id_counter += 1
                    else:
                        # Known age - include all sliprate combinations
                        for sliprate in DOMAIN_VALUES["sliprate"]:
                            template, sentence = generate_sentence(slipsense, mappedscale, faultage, sliprate)
                            permutations.append(SentencePermutation(
                                id=id_counter,
                                template=template,
                                slipsense=slipsense,
                                mappedscale=mappedscale,
                                faultage=faultage,
                                sliprate=sliprate,
                                sentence=sentence
                            ))
                            id_counter += 1

    return permutations


def print_summary(permutations: list[SentencePermutation]) -> None:
    """Print a summary of the generated permutations."""
    by_template = {}
    for p in permutations:
        by_template[p.template] = by_template.get(p.template, 0) + 1

    print("\n=== QFF Sentence Permutations Summary ===\n")
    print("Domain Values:")
    for key, values in DOMAIN_VALUES.items():
        print(f"  - {key}: {len(values)} values")

    print("\nPermutations by Template:")
    for template, count in by_template.items():
        print(f"  - {template}: {count}")

    print(f"\nTotal Permutations: {len(permutations)}")


def write_csv(permutations: list[SentencePermutation], filepath: Path) -> None:
    """Write permutations to CSV file."""
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["id", "template", "slipsense", "mappedscale", "faultage", "sliprate", "sentence"])
        writer.writeheader()
        for p in permutations:
            writer.writerow(asdict(p))


def write_json(permutations: list[SentencePermutation], filepath: Path) -> None:
    """Write permutations to JSON file."""
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump([asdict(p) for p in permutations], f, indent=2)


def write_unique_sentences(permutations: list[SentencePermutation], filepath: Path) -> None:
    """Write unique sentences to text file."""
    unique_sentences = list(dict.fromkeys(p.sentence for p in permutations))
    with open(filepath, "w", encoding="utf-8") as f:
        f.write("\n\n".join(unique_sentences))
    return len(unique_sentences)


def main():
    # Generate permutations
    permutations = generate_all_permutations()
    print_summary(permutations)

    # Create output directory
    output_dir = Path(__file__).parent / "output"
    output_dir.mkdir(exist_ok=True)

    # Write CSV
    csv_path = output_dir / "qff-sentence-permutations.csv"
    write_csv(permutations, csv_path)
    print(f"\nCSV written to: {csv_path}")

    # Write JSON
    json_path = output_dir / "qff-sentence-permutations.json"
    write_json(permutations, json_path)
    print(f"JSON written to: {json_path}")

    # Write unique sentences
    unique_path = output_dir / "qff-unique-sentences.txt"
    unique_count = write_unique_sentences(permutations, unique_path)
    print(f"Unique sentences ({unique_count}) written to: {unique_path}")


if __name__ == "__main__":
    main()

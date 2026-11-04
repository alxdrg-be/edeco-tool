"""Filled form values remain visible and editable during native page operations."""
import base64
from io import BytesIO
import zipfile

from PIL import Image
from pypdf import PdfReader
from pypdf import PdfWriter
from pypdf.generic import NameObject
import pytest

from edeco_toolbox.pdf_workshop.client import PdfFile
from edeco_toolbox.pdf_workshop.crop import CropStore
from edeco_toolbox.pdf_workshop.operations import Options, raster_images, resize_pdf, split_pdf
from edeco_toolbox.pdf_workshop.workbench import PageSelection, compose_pdf, inspect_pdf
from test_pdf_marks import form_pdf


def red_pixels(image):
    return sum(red > 180 and green < 70 and blue < 70 for red, green, blue in image.convert("RGB").getdata())


@pytest.mark.parametrize("rotation", [0, 90, 180, 270])
def test_filled_fields_are_visible_in_thumbnails_large_previews_and_image_output(rotation):
    source = form_pdf(rotation)
    thumbnail = inspect_pdf(source)["pages"][0]["thumbnail"].split(",", 1)[1]
    with Image.open(BytesIO(base64.b64decode(thumbnail))) as image:
        assert red_pixels(image) > 100
    store = CropStore()
    try:
        doc = store.add(source, "Formular.pdf")
        with Image.open(BytesIO(store.preview(doc["id"], 1, 800))) as image:
            assert red_pixels(image) > 1000
    finally:
        store.close()
    data, extension = raster_images(source, Options(dpi=72))
    assert extension == "png"
    with Image.open(BytesIO(data)) as image:
        assert red_pixels(image) > 1000


def test_repeated_form_page_keeps_fields_and_independent_rotation():
    source = form_pdf()
    result = compose_pdf([PdfFile("Formular.pdf", source)], [PageSelection(file=0, page=1), PageSelection(file=0, page=1, rotation=90)])
    reader = PdfReader(BytesIO(result))
    assert reader.get_fields()["important-field"]["/V"] == "VISIBLE FORM VALUE"
    assert [page.rotation for page in reader.pages] == [0, 90]
    assert all(page.get("/Annots") for page in reader.pages)
    with zipfile.ZipFile(BytesIO(split_pdf(source, Options()))) as archive:
        part = PdfReader(BytesIO(archive.read("Teil-1.pdf")))
        assert part.get_fields()["important-field"]["/V"] == "VISIBLE FORM VALUE"


def test_combining_two_forms_namespaces_conflicting_field_names():
    source = form_pdf()
    result = compose_pdf([PdfFile("A.pdf", source), PdfFile("B.pdf", source)], [PageSelection(file=0, page=1), PageSelection(file=1, page=1)])
    fields = PdfReader(BytesIO(result)).get_fields()
    assert fields["source_1.important-field"]["/V"] == "VISIBLE FORM VALUE"
    assert fields["source_2.important-field"]["/V"] == "VISIBLE FORM VALUE"


def test_resize_declines_interactive_forms_instead_of_losing_their_fields():
    with pytest.raises(ValueError, match="Formularfelder"):
        resize_pdf(form_pdf(90), Options(page_size="A4"))


def test_resize_declines_rotated_annotations_instead_of_moving_their_appearance():
    writer = PdfWriter(clone_from=PdfReader(BytesIO(form_pdf(90))))
    del writer._root_object["/AcroForm"]
    annotation = writer.pages[0]["/Annots"][0].get_object()
    annotation[NameObject("/Subtype")] = NameObject("/Square")
    output = BytesIO()
    writer.write(output)
    with pytest.raises(ValueError, match="Anmerkungen"):
        resize_pdf(output.getvalue(), Options(page_size="KEEP", scale=100))

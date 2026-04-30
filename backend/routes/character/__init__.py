"""
Character routes package — split from the old monolithic
`character_routes.py` (2700+ lines) during the iter95 refactor.

Layout:
    _common.py    → shared `router`, db handle, helpers, request/response
                    models. Importing this module is enough to set up the
                    APIRouter; the sub-modules below register their routes
                    on that very same `router` instance.
    drafts.py     → character creation wizard (drafts + finalize).
    core.py       → CRUD, HP/fatigue/XP/short&long rests, public-code,
                    location.
    equipment.py  → rewards, inventory carry/edit-item, mount CRUD &
                    encumbrance.

External callers should keep importing the same symbol they used before:

    from routes.character import router as character_router
"""

# Importing each sub-module triggers its `@router.<verb>(…)` decorators
# which register the routes on the shared APIRouter from `_common`.
from . import _common  # noqa: F401  (defines the shared router)
from . import drafts   # noqa: F401
from . import core     # noqa: F401
from . import equipment  # noqa: F401

from ._common import router  # re-export

__all__ = ["router"]

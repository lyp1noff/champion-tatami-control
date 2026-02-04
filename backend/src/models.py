from datetime import date, datetime, time
from typing import List, Optional

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, Time, UniqueConstraint, func
from sqlalchemy.orm import DeclarativeBase, Mapped, declared_attr, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    @declared_attr
    def created_at(cls) -> Mapped[datetime]:
        return mapped_column(DateTime(timezone=True), default=func.now())

    @declared_attr
    def updated_at(cls) -> Mapped[datetime]:
        return mapped_column(DateTime(timezone=True), default=func.now(), onupdate=func.now())


class Tournament(Base, TimestampMixin):
    __tablename__ = "tournaments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    external_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    location: Mapped[str] = mapped_column(String, nullable=False)
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False)

    brackets: Mapped[List["Bracket"]] = relationship("Bracket", back_populates="tournament", cascade="all, delete")
    timetable_entries: Mapped[List["TimetableEntry"]] = relationship(
        "TimetableEntry", back_populates="tournament", cascade="all, delete-orphan"
    )
    outbox_items: Mapped[List["OutboxItem"]] = relationship("OutboxItem", back_populates="tournament")


class Bracket(Base, TimestampMixin):
    __tablename__ = "brackets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    external_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    tournament_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournaments.id", ondelete="CASCADE"))
    category: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    group_id: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[Optional[str]] = mapped_column(String)
    state: Mapped[str] = mapped_column(String, nullable=False, default="draft")
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    display_name: Mapped[Optional[str]] = mapped_column(String)

    tournament: Mapped["Tournament"] = relationship("Tournament", back_populates="brackets")
    matches: Mapped[List["BracketMatch"]] = relationship(
        "BracketMatch", back_populates="bracket", cascade="all, delete"
    )
    participants: Mapped[List["BracketParticipant"]] = relationship(
        "BracketParticipant", back_populates="bracket", cascade="all, delete-orphan"
    )
    timetable_entry: Mapped[Optional["TimetableEntry"]] = relationship(
        "TimetableEntry", back_populates="bracket", uselist=False, cascade="all, delete-orphan"
    )

    @property
    def tatami(self) -> Optional[int]:
        return self.timetable_entry.tatami if self.timetable_entry is not None else None

    @property
    def day(self) -> Optional[int]:
        return self.timetable_entry.day if self.timetable_entry is not None else None

    @property
    def start_time(self) -> Optional[str]:
        if self.timetable_entry is None:
            return None
        return self.timetable_entry.start_time.strftime("%H:%M:%S")


class TimetableEntry(Base, TimestampMixin):
    __tablename__ = "timetable_entries"
    __table_args__ = (UniqueConstraint("bracket_id", name="uix_timetable_bracket_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(Integer, ForeignKey("tournaments.id", ondelete="CASCADE"), index=True)
    bracket_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("brackets.id", ondelete="CASCADE"), nullable=True, index=True
    )
    entry_type: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    day: Mapped[int] = mapped_column(Integer, nullable=False)
    tatami: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    tournament: Mapped["Tournament"] = relationship("Tournament", back_populates="timetable_entries")
    bracket: Mapped[Optional["Bracket"]] = relationship("Bracket", back_populates="timetable_entry")


class Athlete(Base, TimestampMixin):
    __tablename__ = "athletes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    external_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    coaches_last_name: Mapped[str] = mapped_column(String, nullable=False)

    matches_as_athlete1: Mapped[List["Match"]] = relationship(
        "Match", foreign_keys="[Match.athlete1_id]", back_populates="athlete1"
    )
    matches_as_athlete2: Mapped[List["Match"]] = relationship(
        "Match", foreign_keys="[Match.athlete2_id]", back_populates="athlete2"
    )
    bracket_participations: Mapped[List["BracketParticipant"]] = relationship(
        "BracketParticipant", back_populates="athlete"
    )


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    external_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    athlete1_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("athletes.id"), nullable=True)
    athlete2_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("athletes.id"), nullable=True)
    winner_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    score_athlete1: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    score_athlete2: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    round_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    stage: Mapped[str] = mapped_column(String, nullable=False, default="main")
    repechage_side: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    repechage_step: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String, default="not_started")
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    athlete1: Mapped[Optional["Athlete"]] = relationship(
        "Athlete", foreign_keys=[athlete1_id], back_populates="matches_as_athlete1"
    )
    athlete2: Mapped[Optional["Athlete"]] = relationship(
        "Athlete", foreign_keys=[athlete2_id], back_populates="matches_as_athlete2"
    )

    bracket_matches: Mapped[List["BracketMatch"]] = relationship(
        "BracketMatch", back_populates="match", cascade="all, delete"
    )
    match_state: Mapped[Optional["MatchState"]] = relationship(
        "MatchState", uselist=False, back_populates="match", cascade="all, delete"
    )
    outbox_items: Mapped[List["OutboxItem"]] = relationship("OutboxItem", back_populates="match")


class BracketMatch(Base):
    __tablename__ = "bracket_matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    external_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    bracket_id: Mapped[int] = mapped_column(Integer, ForeignKey("brackets.id", ondelete="CASCADE"))
    match_id: Mapped[int] = mapped_column(Integer, ForeignKey("matches.id", ondelete="CASCADE"))
    round_number: Mapped[int] = mapped_column(Integer)
    position: Mapped[int] = mapped_column(Integer)
    next_slot: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    bracket: Mapped["Bracket"] = relationship("Bracket", back_populates="matches")
    match: Mapped["Match"] = relationship("Match", back_populates="bracket_matches")


class BracketParticipant(Base):
    __tablename__ = "bracket_participants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    bracket_id: Mapped[int] = mapped_column(Integer, ForeignKey("brackets.id", ondelete="CASCADE"), index=True)
    athlete_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("athletes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    seed: Mapped[int] = mapped_column(Integer, nullable=False)

    bracket: Mapped["Bracket"] = relationship("Bracket", back_populates="participants")
    athlete: Mapped[Optional["Athlete"]] = relationship("Athlete", back_populates="bracket_participations")


class OutboxItem(Base, TimestampMixin):
    __tablename__ = "outbox_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("tournaments.id"), nullable=True)
    match_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("matches.id"), nullable=True)
    endpoint: Mapped[str] = mapped_column(String, nullable=False)
    method: Mapped[str] = mapped_column(String, nullable=False)
    payload: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String, default="pending")
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    max_retries: Mapped[int] = mapped_column(Integer, default=10)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    tournament: Mapped[Optional["Tournament"]] = relationship("Tournament", back_populates="outbox_items")
    match: Mapped[Optional["Match"]] = relationship("Match", back_populates="outbox_items")


class MatchState(Base, TimestampMixin):
    __tablename__ = "match_states"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    match_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("matches.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    status: Mapped[str] = mapped_column(String, default="idle")
    start_timestamp: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    paused_elapsed: Mapped[int] = mapped_column(Integer, default=0)
    elapsed: Mapped[int] = mapped_column(Integer, default=0)
    duration_ms: Mapped[int] = mapped_column(Integer, default=60000)
    score1: Mapped[int] = mapped_column(Integer, default=0)
    score2: Mapped[int] = mapped_column(Integer, default=0)
    shido1: Mapped[int] = mapped_column(Integer, default=0)
    shido2: Mapped[int] = mapped_column(Integer, default=0)

    match: Mapped["Match"] = relationship("Match", back_populates="match_state")


class GlobalSettings(Base):
    __tablename__ = "global_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    key: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    value: Mapped[Optional[str]] = mapped_column(String, nullable=True)

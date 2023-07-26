package com.zucchini.domain.item.domain;

import lombok.*;

import javax.persistence.*;
import java.util.Date;

@Entity
@Getter
@ToString
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "date")
public class ItemDate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int no;

    @ManyToOne(targetEntity = Item.class, fetch = FetchType.LAZY)
    @JoinColumn(name = "item_no", insertable = false, updatable = false)
    private Item item;
    @Column(name = "item_no")
    private Integer itemNo;

    private Date date;

    @Builder
    public ItemDate(int itemNo, Date date) {
        this.itemNo = itemNo;
        this.date = date;
    }

}
